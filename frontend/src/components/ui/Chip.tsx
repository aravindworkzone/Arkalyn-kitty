import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../helpers/cn";

/**
 * Selectable pill. The create-expense form had five hand-rolled copies of this
 * (categories, credit pools, payment types, payer, split members, date presets)
 * with slightly different padding and hover states each time.
 *
 * `accentColor` is for chips whose colour is user data — a category's stored
 * hex. Everything else selects on the brand tokens. When an accent is given the
 * selected state has to be inline: the value only exists at runtime.
 */
interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    selected?: boolean;
    accentColor?: string;
    /** Renders the leading colour dot. Implied whenever accentColor is set. */
    dot?: boolean;
    /** Dashed outline — the "add new" affordance rather than a real choice. */
    dashed?: boolean;
    children: ReactNode;
}

export default function Chip({
    selected = false,
    accentColor,
    dot,
    dashed = false,
    className,
    children,
    ...rest
}: ChipProps) {
    const showDot = dot ?? Boolean(accentColor);

    return (
        <button
            {...rest}
            type={rest.type ?? "button"}
            aria-pressed={dashed ? undefined : selected}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-theme-xs font-semibold border transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                dashed
                    ? "border-dashed border-line-strong text-fg-muted hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400"
                    : selected
                        ? accentColor
                            ? "" /* colours come from `style` below */
                            : "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/35 dark:text-brand-300"
                        : "bg-surface-raised border-line text-fg-muted hover:bg-surface-hover hover:text-fg",
                className
            )}
            style={
                selected && accentColor
                    ? {
                          background: accentColor + "25",
                          borderColor: accentColor + "60",
                          color: accentColor,
                      }
                    : rest.style
            }
        >
            {showDot && (
                <span
                    className={cn("w-1.5 h-1.5 rounded-full shrink-0", !selected && "bg-fg-subtle")}
                    style={selected && accentColor ? { background: accentColor } : undefined}
                />
            )}
            {children}
        </button>
    );
}
