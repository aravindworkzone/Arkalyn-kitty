import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useFormField } from "./formFieldContext";
import { cn } from "../../helpers/cn";

/**
 * Searchable single-select.
 *
 * UI_PROMPT specifies ng-select, which is Angular-only, so this reimplements
 * its documented visual contract: 42px trigger, rounded-lg, brand-300 border
 * and a 2px brand ring when open, rounded-xl panel with brand-50 marked rows
 * and a brand-600 selected row (brand-500/10 and /15 + brand-400 in dark).
 *
 * Replaces the legacy MemberSelect (a styled native <select>) and the raw
 * <select> elements in the admin sections.
 *
 * Interaction: trigger button opens a panel holding a filter box and the list.
 * Keeping search inside the panel rather than turning the trigger itself into
 * a text field is what makes this usable on touch — the closed control stays a
 * plain tappable target that never raises the keyboard by accident.
 *
 * KNOWN LIMIT: the panel is absolutely positioned, not portalled, so a very
 * long list inside a short `overflow-y-auto` container (BottomSheet) can clip.
 * Portalling needs a positioning engine; revisit if a real screen hits it.
 */

export interface SelectOption {
    value: string;
    label: string;
    /** Secondary line under the label — role, email, hint. */
    description?: string;
    disabled?: boolean;
}

interface SelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Shows the filter box. Auto-hidden for short lists unless forced true. */
    searchable?: boolean;
    searchPlaceholder?: string;
    emptyLabel?: string;
    disabled?: boolean;
    invalid?: boolean;
    /** Rendered instead of the plain label for the selected value and rows. */
    renderOption?: (option: SelectOption) => ReactNode;
    className?: string;
    name?: string;
}

const SEARCH_THRESHOLD = 7;

export default function Select({
    options,
    value,
    onChange,
    placeholder = "Select…",
    searchable,
    searchPlaceholder = "Search…",
    emptyLabel = "No matches",
    disabled = false,
    invalid,
    renderOption,
    className,
    name,
}: SelectProps) {
    const field = useFormField();
    const isInvalid = invalid ?? field?.invalid ?? false;

    const reactId = useId();
    const listboxId = `${reactId}-listbox`;
    const optionId = (i: number) => `${reactId}-opt-${i}`;

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);

    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const showSearch = searchable ?? options.length >= SEARCH_THRESHOLD;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter(
            (o) =>
                o.label.toLowerCase().includes(q) ||
                (o.description?.toLowerCase().includes(q) ?? false)
        );
    }, [options, query]);

    const selected = options.find((o) => o.value === value) ?? null;

    const close = (returnFocus = true) => {
        setOpen(false);
        setQuery("");
        if (returnFocus) triggerRef.current?.focus();
    };

    const commit = (option: SelectOption) => {
        if (option.disabled) return;
        onChange(option.value);
        close();
    };

    // Open with the current selection highlighted, so arrow keys continue from
    // where the user is rather than jumping to the top of the list.
    useEffect(() => {
        if (!open) return;
        const i = filtered.findIndex((o) => o.value === value);
        setActiveIndex(i >= 0 ? i : 0);
        if (showSearch) searchRef.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Filtering can shrink the list out from under the cursor.
    useEffect(() => {
        setActiveIndex((i) => (i >= filtered.length ? 0 : i));
    }, [filtered.length]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: MouseEvent | TouchEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) close(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
        };
    }, [open]);

    // Keep the highlighted row in view during keyboard traversal.
    useEffect(() => {
        if (!open) return;
        listRef.current
            ?.querySelector(`[data-index="${activeIndex}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, open]);

    const move = (delta: number) => {
        if (filtered.length === 0) return;
        setActiveIndex((i) => {
            let next = i;
            // Step over disabled rows rather than parking on them.
            for (let step = 0; step < filtered.length; step++) {
                next = (next + delta + filtered.length) % filtered.length;
                if (!filtered[next]?.disabled) break;
            }
            return next;
        });
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                if (!open) setOpen(true);
                else move(1);
                break;
            case "ArrowUp":
                e.preventDefault();
                if (!open) setOpen(true);
                else move(-1);
                break;
            case "Home":
                if (open) { e.preventDefault(); setActiveIndex(0); }
                break;
            case "End":
                if (open) { e.preventDefault(); setActiveIndex(filtered.length - 1); }
                break;
            case "Enter":
                if (open) {
                    e.preventDefault();
                    const option = filtered[activeIndex];
                    if (option) commit(option);
                }
                break;
            case "Escape":
                if (open) { e.preventDefault(); close(); }
                break;
            case "Tab":
                if (open) close(false);
                break;
        }
    };

    return (
        <div ref={rootRef} className={cn("relative w-full", className)} onKeyDown={onKeyDown}>
            {/* Keeps the value in native form submissions / FormData. */}
            {name && <input type="hidden" name={name} value={value} />}

            <button
                ref={triggerRef}
                type="button"
                id={field?.id}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-describedby={field?.describedBy}
                aria-invalid={isInvalid || undefined}
                onClick={() => setOpen((p) => !p)}
                className={cn(
                    "flex min-h-[42px] w-full items-center justify-between gap-2 rounded-lg border px-4 py-2",
                    "bg-white text-left text-theme-sm text-gray-800 shadow-theme-xs transition",
                    "dark:bg-gray-900 dark:text-white/90",
                    "focus:outline-none",
                    isInvalid
                        ? "border-error-500 focus-visible:ring-2 focus-visible:ring-error-500/10"
                        : open
                          ? "border-brand-300 ring-2 ring-brand-500/10"
                          : "border-gray-300 focus-visible:border-brand-300 focus-visible:ring-2 focus-visible:ring-brand-500/10 dark:border-gray-700",
                    "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
                    "dark:disabled:bg-gray-900/50 dark:disabled:text-gray-600"
                )}
            >
                <span className={cn("min-w-0 truncate", !selected && "text-gray-400")}>
                    {selected ? (renderOption?.(selected) ?? selected.label) : placeholder}
                </span>
                <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                    className={cn("shrink-0 text-fg-subtle transition-transform duration-200", open && "rotate-180")}
                >
                    <path d="M2 3.5L5 6.5l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {open && (
                <div
                    className="absolute left-0 right-0 top-[calc(100%+4px)] z-dropdown overflow-hidden
                        rounded-xl border border-line bg-surface-overlay shadow-theme-md"
                >
                    {showSearch && (
                        <div className="border-b border-line p-2">
                            <input
                                ref={searchRef}
                                type="text"
                                role="combobox"
                                aria-expanded
                                aria-controls={listboxId}
                                aria-activedescendant={filtered.length ? optionId(activeIndex) : undefined}
                                aria-autocomplete="list"
                                aria-label={searchPlaceholder}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-theme-sm
                                    text-gray-800 placeholder:text-gray-400 outline-none
                                    focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10
                                    dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                            />
                        </div>
                    )}

                    <div
                        ref={listRef}
                        id={listboxId}
                        role="listbox"
                        aria-label={placeholder}
                        className="max-h-[240px] overflow-y-auto py-1"
                    >
                        {filtered.length === 0 && (
                            <p className="px-4 py-6 text-center text-theme-xs text-fg-muted">{emptyLabel}</p>
                        )}

                        {filtered.map((option, i) => {
                            const isSelected = option.value === value;
                            const isActive = i === activeIndex;
                            return (
                                <div
                                    key={option.value}
                                    id={optionId(i)}
                                    data-index={i}
                                    role="option"
                                    aria-selected={isSelected}
                                    aria-disabled={option.disabled || undefined}
                                    onClick={() => commit(option)}
                                    onMouseEnter={() => !option.disabled && setActiveIndex(i)}
                                    className={cn(
                                        "cursor-pointer px-4 py-2 text-theme-sm transition-colors",
                                        option.disabled && "cursor-not-allowed opacity-40",
                                        isSelected
                                            ? "bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                                            : isActive
                                              ? "bg-brand-50 text-fg dark:bg-brand-500/10 dark:text-white"
                                              : "text-fg"
                                    )}
                                >
                                    {renderOption?.(option) ?? (
                                        <>
                                            <span className="block truncate">{option.label}</span>
                                            {option.description && (
                                                <span className="block truncate text-theme-xs text-fg-muted">
                                                    {option.description}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
