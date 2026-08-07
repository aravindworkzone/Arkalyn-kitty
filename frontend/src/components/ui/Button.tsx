import type { ButtonHTMLAttributes, ReactNode } from "react";
import Spinner from "./Spinner";
import { cn } from "../../helpers/cn";

/**
 * Design-system button (UI_PROMPT .btn-primary / .btn-secondary).
 *
 * `primary` and `secondary` are the documented variants. `ghost` and
 * `destructive` are extensions this app genuinely needs — subtle icon actions,
 * and the delete/close/leave flows in groupSettings — added here so phase 5
 * doesn't hand-roll them per screen.
 *
 * Not to be confused with the legacy ActionButton, whose `tone` prop maps to
 * dark-only alpha fills. That one stays until its screens are migrated.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    /** Swapped in for the label while `loading`. Falls back to `children`. */
    loadingLabel?: ReactNode;
    fullWidth?: boolean;
    children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
    primary: "bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500/20",
    secondary:
        "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-brand-500/20 " +
        "dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10",
    ghost:
        "text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-brand-500/20",
    // error-600 rather than the scale's base 500: white on error-500 is only
    // 3.76:1, which fails AA for button text. error-600 gives 4.83:1.
    destructive:
        "bg-error-600 text-white hover:bg-error-700 focus-visible:ring-error-500/20",
};

const sizeClass: Record<ButtonSize, string> = {
    sm: "px-3 py-2 text-theme-xs",
    md: "px-4 py-2.5 text-theme-sm",
};

export default function Button({
    variant = "primary",
    size = "md",
    loading = false,
    loadingLabel,
    fullWidth = false,
    disabled,
    className,
    type = "button",
    children,
    ...rest
}: ButtonProps) {
    return (
        <button
            {...rest}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition",
                "focus:outline-none focus-visible:ring-4",
                "disabled:cursor-not-allowed disabled:opacity-50",
                sizeClass[size],
                variantClass[variant],
                fullWidth && "w-full",
                className
            )}
        >
            {loading && <Spinner size={size === "sm" ? 13 : 15} />}
            {loading ? (loadingLabel ?? children) : children}
        </button>
    );
}
