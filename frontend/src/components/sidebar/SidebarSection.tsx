import { useState, type ReactNode } from "react";
import { cn } from "../../helpers/cn";

/**
 * A collapsible labelled block — Favorites, All groups, Filters, Members.
 *
 * Collapsed rail: the section header would be nothing but a truncated word, so
 * it is dropped entirely and only the children render, separated by the rule
 * the wrapper already draws. The disclosure state is kept in local state rather
 * than persisted — unlike the sidebar's own collapse, which is a deliberate
 * layout choice, section open/closed is cheap to redo and not worth a storage
 * key per section.
 */

interface SidebarSectionProps {
    title: string;
    count?: number;
    collapsed?: boolean;
    defaultOpen?: boolean;
    /** Rendered on the right of the header, e.g. an inline "+" action. */
    action?: ReactNode;
    children: ReactNode;
}

export default function SidebarSection({
    title,
    count,
    collapsed = false,
    defaultOpen = true,
    action,
    children,
}: SidebarSectionProps) {
    const [open, setOpen] = useState(defaultOpen);

    if (collapsed) {
        return <div className="flex flex-col gap-1">{children}</div>;
    }

    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-1 pr-1">
                <button
                    type="button"
                    onClick={() => setOpen((p) => !p)}
                    aria-expanded={open}
                    className="group/sec flex flex-1 items-center gap-1.5 px-2.5 py-1.5 rounded-lg min-w-0
                        text-theme-2xs font-semibold uppercase tracking-[0.14em] text-fg-muted
                        hover:text-fg hover:bg-surface-hover transition-colors duration-150
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        aria-hidden="true"
                        className={cn("shrink-0 transition-transform duration-200", open ? "rotate-90" : "")}
                    >
                        <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="truncate">{title}</span>
                    {typeof count === "number" && count > 0 && (
                        <span className="shrink-0 text-fg-subtle" translate="no">
                            {count}
                        </span>
                    )}
                </button>
                {action}
            </div>

            {open && <div className="flex flex-col gap-0.5 mt-0.5">{children}</div>}
        </div>
    );
}
