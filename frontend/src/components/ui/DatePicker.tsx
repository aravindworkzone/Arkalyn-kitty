import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormField } from "./formFieldContext";
import { cn } from "../../helpers/cn";
import {
    addDays,
    addMonths,
    isSameDay as sameDay,
    monthGrid,
    parseISODate as parseISO,
    toISODate as toISO,
} from "../../helpers/date";

/**
 * Date field. Value is an ISO `YYYY-MM-DD` string — the same shape a native
 * <input type="date"> uses, so call sites migrating off one don't change.
 *
 * UI_PROMPT names flatpickr (Angular-era) and specifies a brand-themed
 * calendar: brand-500 selected day, brand-500 border on today, brand-50 hover,
 * gray-800 calendar in dark. That is implemented here for pointer devices.
 *
 * ON TOUCH IT DEFERS TO THE NATIVE INPUT, on purpose. The OS date wheel is
 * better than any in-page calendar on a phone, and this app is a mobile-first
 * PWA. The branch lives inside this component so callers never deal with it.
 * Native popups are unthemeable and differ per browser, which is precisely the
 * inconsistency the custom panel fixes on desktop.
 */

interface DatePickerProps {
    /** ISO `YYYY-MM-DD`, or "" for empty. */
    value: string;
    onChange: (value: string) => void;
    min?: string;
    max?: string;
    disabled?: boolean;
    invalid?: boolean;
    placeholder?: string;
    className?: string;
    name?: string;
}

const useCoarsePointer = (): boolean => {
    const [coarse, setCoarse] = useState(
        () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
    );
    useEffect(() => {
        const mq = window.matchMedia("(pointer: coarse)");
        const on = () => setCoarse(mq.matches);
        mq.addEventListener("change", on);
        return () => mq.removeEventListener("change", on);
    }, []);
    return coarse;
};

export default function DatePicker({
    value,
    onChange,
    min,
    max,
    disabled = false,
    invalid,
    placeholder,
    className,
    name,
}: DatePickerProps) {
    const { i18n, t } = useTranslation();
    const field = useFormField();
    const isInvalid = invalid ?? field?.invalid ?? false;
    const coarse = useCoarsePointer();

    const selected = parseISO(value);
    const minDate = min ? parseISO(min) : null;
    const maxDate = max ? parseISO(max) : null;

    const [open, setOpen] = useState(false);
    const [cursor, setCursor] = useState<Date>(() => selected ?? new Date());
    const [focusDay, setFocusDay] = useState<Date>(() => selected ?? new Date());

    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const locale = i18n.language === "ta" ? "ta-IN" : "en-IN";

    const monthLabel = useMemo(
        () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor),
        [cursor, locale]
    );

    const weekdays = useMemo(() => {
        const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
        // 2024-01-07 was a Sunday — anchor the labels to a known week.
        return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + i)));
    }, [locale]);

    const displayLabel = useMemo(() => {
        if (!selected) return null;
        return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(selected);
    }, [selected, locale]);

    const outOfRange = (d: Date): boolean =>
        (minDate !== null && d < minDate) || (maxDate !== null && d > maxDate);

    const close = (returnFocus = true) => {
        setOpen(false);
        if (returnFocus) triggerRef.current?.focus();
    };

    const commit = (d: Date) => {
        if (outOfRange(d)) return;
        onChange(toISO(d));
        close();
    };

    useEffect(() => {
        if (!open) return;
        const base = selected ?? new Date();
        setCursor(base);
        setFocusDay(base);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) close(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [open]);

    const moveFocus = (next: Date) => {
        setFocusDay(next);
        if (next.getMonth() !== cursor.getMonth() || next.getFullYear() !== cursor.getFullYear()) {
            setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
        }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!open) {
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        switch (e.key) {
            case "ArrowLeft":  e.preventDefault(); moveFocus(addDays(focusDay, -1)); break;
            case "ArrowRight": e.preventDefault(); moveFocus(addDays(focusDay, 1)); break;
            case "ArrowUp":    e.preventDefault(); moveFocus(addDays(focusDay, -7)); break;
            case "ArrowDown":  e.preventDefault(); moveFocus(addDays(focusDay, 7)); break;
            case "PageUp":     e.preventDefault(); moveFocus(addMonths(focusDay, -1)); break;
            case "PageDown":   e.preventDefault(); moveFocus(addMonths(focusDay, 1)); break;
            case "Enter":
            case " ":          e.preventDefault(); commit(focusDay); break;
            case "Escape":     e.preventDefault(); close(); break;
            case "Tab":        close(false); break;
        }
    };

    /* ── Touch: hand over to the platform ─────────────────────────────────
       Styled with the same tokens as Input so it is visually identical to the
       desktop trigger; only the popup differs. `color-scheme` follows the
       theme so the OS picker and the calendar glyph match — the old
       DATE_INPUT_EXTRA pinned this to dark unconditionally.               */
    if (coarse) {
        return (
            <input
                type="date"
                id={field?.id}
                name={name}
                value={value}
                min={min}
                max={max}
                disabled={disabled}
                aria-describedby={field?.describedBy}
                aria-invalid={isInvalid || undefined}
                onChange={(e) => onChange(e.target.value)}
                className={cn(
                    "w-full min-h-[42px] rounded-lg border px-4 py-2 text-theme-sm shadow-theme-xs transition",
                    "bg-white text-gray-800 dark:bg-gray-900 dark:text-white/90",
                    "[color-scheme:light] dark:[color-scheme:dark]",
                    "focus:outline-none focus:ring-2",
                    isInvalid
                        ? "border-error-500 focus:border-error-500 focus:ring-error-500/10"
                        : "border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700",
                    "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
                    "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
                    className
                )}
            />
        );
    }

    const days = monthGrid(cursor);
    const today = new Date();

    return (
        <div ref={rootRef} className={cn("relative w-full", className)} onKeyDown={onKeyDown}>
            {name && <input type="hidden" name={name} value={value} />}

            <button
                ref={triggerRef}
                type="button"
                id={field?.id}
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
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
                    "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                )}
            >
                <span className={cn("truncate", !displayLabel && "text-gray-400")}>
                    {displayLabel ?? placeholder ?? t("common.selectDate", "Select date")}
                </span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                    className="shrink-0 text-fg-subtle">
                    <rect x="2" y="3.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M2 7h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label={monthLabel}
                    className="absolute left-0 top-[calc(100%+4px)] z-dropdown w-[280px] rounded-xl border
                        border-line bg-surface-overlay p-3 shadow-theme-md
                        dark:border-gray-700 dark:bg-gray-800"
                >
                    <div className="mb-2 flex items-center justify-between">
                        <button
                            type="button"
                            aria-label={t("common.prevMonth", "Previous month")}
                            onClick={() => setCursor(addMonths(cursor, -1))}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted
                                hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <span className="text-theme-sm font-medium text-fg" translate="no">{monthLabel}</span>
                        <button
                            type="button"
                            aria-label={t("common.nextMonth", "Next month")}
                            onClick={() => setCursor(addMonths(cursor, 1))}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted
                                hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5">
                        {weekdays.map((w) => (
                            <div key={w} className="py-1 text-center text-theme-2xs font-medium text-fg-subtle" translate="no">
                                {w}
                            </div>
                        ))}

                        {days.map((d) => {
                            const inMonth = d.getMonth() === cursor.getMonth();
                            const isSelected = selected !== null && sameDay(d, selected);
                            const isToday = sameDay(d, today);
                            const isFocus = sameDay(d, focusDay);
                            const blocked = outOfRange(d);

                            return (
                                <button
                                    key={d.getTime()}
                                    type="button"
                                    tabIndex={isFocus ? 0 : -1}
                                    disabled={blocked}
                                    aria-current={isToday ? "date" : undefined}
                                    aria-pressed={isSelected}
                                    onClick={() => commit(d)}
                                    className={cn(
                                        "flex h-8 items-center justify-center rounded-lg text-theme-xs transition-colors",
                                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                                        blocked && "cursor-not-allowed opacity-30",
                                        !inMonth && !isSelected && "text-fg-subtle",
                                        inMonth && !isSelected && "text-fg",
                                        isSelected
                                            ? "border border-brand-500 bg-brand-500 font-medium text-white"
                                            : isToday
                                              ? "border border-brand-500 text-brand-600 dark:text-brand-400"
                                              : !blocked && "hover:bg-brand-50 dark:hover:bg-brand-500/10"
                                    )}
                                >
                                    {d.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
