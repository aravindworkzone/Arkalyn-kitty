import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../helpers/cn";

/**
 * Design-system surface (UI_PROMPT .card).
 *
 * Uses the semantic tokens rather than a `bg-white dark:bg-white/[0.03]` pair —
 * `surface-raised` already resolves to exactly those two values. Dark mode is a
 * ~3% white overlay, never a flat dark fill; the doc is explicit about that and
 * the token encodes it.
 */

// `title` is omitted from the DOM attributes deliberately — here it means the
// card's heading, not the native tooltip attribute (which is string-only).
interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
    /** Section heading rendered in a bordered header strip. */
    title?: ReactNode;
    /** Trailing header content — actions, counts, a badge. */
    headerRight?: ReactNode;
    /** Set false when the card's children manage their own padding (lists, tables). */
    padded?: boolean;
    children: ReactNode;
}

export default function Card({
    title,
    headerRight,
    padded = true,
    className,
    children,
    ...rest
}: CardProps) {
    const hasHeader = title !== undefined || headerRight !== undefined;

    return (
        <div
            {...rest}
            className={cn(
                "rounded-2xl border border-line bg-surface-raised shadow-theme-xs",
                !hasHeader && padded && "p-5",
                hasHeader && "overflow-hidden",
                className
            )}
        >
            {hasHeader && (
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                    {title !== undefined && (
                        <h3 className="text-theme-sm font-medium text-fg">{title}</h3>
                    )}
                    {headerRight}
                </div>
            )}
            {hasHeader ? <div className={cn(padded && "p-5")}>{children}</div> : children}
        </div>
    );
}
