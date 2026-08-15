import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "../../helpers/cn";

/**
 * Collapsible card section.
 *
 * The app had four hand-rolled versions of this (ProfilePage's ChevronRow,
 * GroupMembersPanel, SidebarSection, the CreateCategory row expander) and no
 * shared one, so create-expense had nowhere to put "everything the user usually
 * does not need to touch" and rendered all of it instead.
 *
 * `summary` is the reason this exists rather than a plain show/hide: a closed
 * section still has to say what it will submit ("Cash · Paid by You"), or
 * collapsing it just hides state the user is accountable for.
 *
 * Controlled — the parent owns `open`, because sections need to spring open
 * when a submit lands an error inside them.
 */
interface DisclosureProps {
    title: ReactNode;
    /** Rendered on the right of the header while closed. The section's value. */
    summary?: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Marks the header when something inside needs attention. */
    error?: boolean;
    className?: string;
    contentClass?: string;
    children: ReactNode;
}

export default function Disclosure({
    title,
    summary,
    open,
    onOpenChange,
    error = false,
    className,
    contentClass = "px-5 sm:px-6 pb-5 pt-1",
    children,
}: DisclosureProps) {
    const panelId = useId();

    return (
        <div
            className={cn(
                "rounded-2xl border bg-surface-raised shadow-theme-xs",
                error ? "border-error-300 dark:border-error-500/40" : "border-line",
                className
            )}
        >
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => onOpenChange(!open)}
                className="flex min-h-touch w-full items-center gap-3 rounded-2xl px-5 sm:px-6 py-3.5 text-left
                    transition-colors hover:bg-surface-hover
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
                <span className="text-theme-xs font-semibold uppercase tracking-widest text-fg-muted shrink-0">
                    {title}
                </span>

                {/* The closed section's value. Hidden while open, where the real
                    controls below are already saying the same thing. */}
                {summary !== undefined && !open && (
                    <span className="min-w-0 flex-1 truncate text-right text-theme-xs text-fg-muted">
                        {summary}
                    </span>
                )}

                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                    className={cn(
                        "shrink-0 text-fg-muted transition-transform duration-200 motion-reduce:transition-none",
                        open ? "rotate-90" : "rotate-0",
                        summary === undefined || open ? "ml-auto" : ""
                    )}
                >
                    <path
                        d="M4.5 2.5L8 6l-3.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>

            {/* 0fr→1fr animates to the content's natural height without measuring
                it. `inert` while closed keeps the still-mounted controls out of
                the tab order and off the accessibility tree — a 0px-tall panel
                is invisible but its buttons are not. */}
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="overflow-hidden">
                    <div id={panelId} inert={!open} className={contentClass}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
