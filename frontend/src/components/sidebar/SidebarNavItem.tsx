import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../helpers/cn";

/**
 * One navigation row.
 *
 * Active treatment is the design system's: a `bg-surface-hover` fill plus a
 * brand accent bar on the leading edge, with the brand text colour the bottom
 * nav already uses (components/MobileNav.tsx). The accent bar is a pseudo-free
 * absolutely positioned span rather than a border so the row's padding does not
 * shift by a pixel when it becomes active.
 *
 * When collapsed the label is removed from the flow but kept for screen readers
 * via `title` + `aria-label`; a CSS-only tooltip renders it on hover so the rail
 * stays usable with a mouse.
 */

interface SidebarNavItemProps {
    to?: string;
    onClick?: () => void;
    icon: ReactNode;
    label: string;
    /** Rendered as a count bubble on the right. Hidden when 0 or undefined. */
    badge?: number;
    /**
     * "Something changed here since you last looked" — a red dot on the icon.
     * Red, not brand: the brand badge above is a count the user asked to see,
     * this is an unread marker, and one colour for both made them read as the
     * same thing. Suppressed while a badge is showing, which already says more.
     */
    dot?: boolean;
    collapsed?: boolean;
    /** Route matching. NavLink's own `end` semantics. */
    end?: boolean;
    /** Overrides NavLink matching — for rows whose active state is not a route. */
    active?: boolean;
    disabled?: boolean;
    /** Brand-filled treatment for the one primary CTA per variant. */
    emphasis?: "primary";
    className?: string;
}

const base =
    "group/nav relative flex items-center rounded-lg py-2 min-h-touch lg:min-h-0 " +
    "text-theme-sm font-medium transition-colors duration-150 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";

// Collapsed rows hold nothing but a 20px glyph, so they centre it and drop the
// horizontal padding and gap — with `px-2.5` the icon sat left of centre in the
// 72px rail and every row looked a few pixels out of true.
const layout = (collapsed: boolean) => (collapsed ? "justify-center px-0" : "gap-3 px-2.5");

const rest = "text-fg-muted hover:text-fg hover:bg-surface-hover active:bg-surface-hover";
const on = "text-brand-600 dark:text-brand-400 bg-surface-hover";
const primary =
    "bg-brand-500 text-on-accent hover:bg-brand-600 active:bg-brand-600 shadow-theme-xs";

export default function SidebarNavItem({
    to,
    onClick,
    icon,
    label,
    badge,
    dot = false,
    collapsed = false,
    end = false,
    active,
    disabled = false,
    emphasis,
    className,
}: SidebarNavItemProps) {
    const { t } = useTranslation();

    const body = (isActive: boolean) => (
        <>
            {/* Accent bar. Only for the plain active state — a primary CTA is
                already fully filled and an extra bar just muddies it. */}
            {isActive && !emphasis && (
                <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand-500"
                />
            )}

            <span className="relative shrink-0 flex items-center justify-center w-5 h-5" aria-hidden="true">
                {icon}

                {/* Collapsed rail: a dot stands in for the count, since the
                    number itself has nowhere to go. Anchored to the ICON, not
                    the row — the row is full-rail width, so `right-1` on it put
                    the dot adrift from the centred glyph. */}
                {collapsed && !!badge && badge > 0 && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-surface" />
                )}

                {/* Update dot. Anchored to the icon in BOTH layouts, unlike the
                    count above: at 264px the label can be long enough to push a
                    trailing dot off the row's visible width, and a marker that
                    scrolls out of view marks nothing. */}
                {showDot && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-error-500 ring-2 ring-surface" />
                )}
            </span>

            {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}

            {!collapsed && !!badge && badge > 0 && (
                <span
                    translate="no"
                    className={cn(
                        "shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-theme-2xs font-semibold",
                        "inline-flex items-center justify-center",
                        emphasis
                            ? "bg-on-accent/20 text-on-accent"
                            : "bg-brand-500 text-on-accent"
                    )}
                >
                    {badge > 99 ? "99+" : badge}
                </span>
            )}

            {collapsed && (
                <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full ml-2 z-dropdown whitespace-nowrap
                        rounded-md bg-surface-overlay border border-line px-2 py-1
                        text-theme-xs font-medium text-fg shadow-theme-md
                        opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150"
                >
                    {label}
                </span>
            )}
        </>
    );

    // The dot is decoration inside an aria-hidden span, so the row carries the
    // fact in its accessible name instead. Undefined when there is nothing to
    // add and the label is already on screen — an aria-label that only repeats
    // the visible text is noise.
    const showDot = dot && !(badge && badge > 0);
    const ariaLabel = showDot
        ? t("sidebar.updatedAria", { label, defaultValue: "{{label}} — updated" })
        : collapsed
          ? label
          : undefined;

    const shared = cn(
        base,
        layout(collapsed),
        emphasis === "primary" && primary,
        disabled && "opacity-50 pointer-events-none",
        className
    );

    if (to && !disabled) {
        return (
            <NavLink
                to={to}
                end={end}
                title={collapsed ? label : undefined}
                aria-label={ariaLabel}
                onClick={onClick}
                className={({ isActive }) => {
                    const isOn = active ?? isActive;
                    return cn(shared, !emphasis && (isOn ? on : rest));
                }}
            >
                {({ isActive }) => body(active ?? isActive)}
            </NavLink>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={collapsed ? label : undefined}
            aria-label={ariaLabel}
            className={cn(shared, !emphasis && (active ? on : rest), "w-full")}
        >
            {body(!!active)}
        </button>
    );
}
