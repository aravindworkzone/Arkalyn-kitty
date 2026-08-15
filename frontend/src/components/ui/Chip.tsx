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
 *
 * `variant` exists because that same form then rendered six *different
 * questions* as one identical pill shape, which on a phone is a wall of
 * interchangeable grey. Categories, payment types and people are different
 * kinds of answer and now look like it. `pill` stays byte-for-byte what it was,
 * because the sidebar and expense filters are dense by design and must not grow
 * to a 44px touch target; the form variants must.
 */
export type ChipVariant = "pill" | "choice" | "tile" | "avatar";

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    selected?: boolean;
    accentColor?: string;
    /** Renders the leading colour dot. Implied whenever accentColor is set. */
    dot?: boolean;
    /** Dashed outline — the "add new" affordance rather than a real choice. */
    dashed?: boolean;
    variant?: ChipVariant;
    /**
     * Trailing check on the selected chip. Defaults on for the form variants:
     * selection was signalled by a tint alone, which fails the same rule
     * LimitMeter follows — state never rides on colour by itself. Off for
     * `pill`, where filter rows have no room for it.
     */
    check?: boolean;
    children: ReactNode;
}

const variantClass: Record<ChipVariant, string> = {
    pill: "gap-1.5 px-3 py-1.5 rounded-xl text-theme-xs",
    choice: "gap-1.5 px-3.5 py-2 rounded-xl text-theme-xs min-h-touch",
    tile: "flex-col justify-center gap-1 px-2 py-3 rounded-xl text-theme-2xs min-h-touch",
    avatar: "gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full text-theme-xs min-h-touch",
};

export default function Chip({
    selected = false,
    accentColor,
    dot,
    dashed = false,
    variant = "pill",
    check,
    className,
    children,
    ...rest
}: ChipProps) {
    const showDot = dot ?? Boolean(accentColor);
    const showCheck = (check ?? variant !== "pill") && selected && !dashed;

    return (
        <button
            {...rest}
            type={rest.type ?? "button"}
            aria-pressed={dashed ? undefined : selected}
            className={cn(
                "inline-flex items-center font-semibold border transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                variantClass[variant],
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
            {showCheck && (
                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                    className="shrink-0"
                >
                    <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </button>
    );
}
