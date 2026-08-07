import type { ButtonHTMLAttributes, ReactNode } from "react";
import Spinner from "./Spinner";

/**
 * Soft-filled action button — a tinted fill with a matching border, used for
 * the in-context actions in group settings and the activity rows.
 *
 * Distinct from <Button>: that one is the solid primary/secondary pair from
 * UI_PROMPT. This is the low-emphasis tinted variant those screens are built
 * around. Tones are semantic; the old literal hue names (cyan/violet/green/
 * amber/red) are gone.
 */
export type Tone = "brand" | "success" | "warning" | "error" | "neutral";

interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  tone?: Tone;
  loading?: boolean;
  loadingLabel?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
}

const toneMap: Record<Tone, string> = {
  brand:
    "bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100 active:bg-brand-100 " +
    "dark:bg-brand-500/15 dark:border-brand-500/25 dark:text-brand-300 dark:hover:bg-brand-500/25",
  success:
    "bg-success-50 border-success-200 text-success-700 hover:bg-success-100 active:bg-success-100 " +
    "dark:bg-success-500/15 dark:border-success-500/25 dark:text-success-300 dark:hover:bg-success-500/25",
  warning:
    "bg-warning-50 border-warning-200 text-warning-800 hover:bg-warning-100 active:bg-warning-100 " +
    "dark:bg-warning-500/15 dark:border-warning-500/25 dark:text-warning-300 dark:hover:bg-warning-500/25",
  error:
    "bg-error-50 border-error-200 text-error-700 hover:bg-error-100 active:bg-error-100 " +
    "dark:bg-error-500/10 dark:border-error-500/20 dark:text-error-400 dark:hover:bg-error-500/20",
  neutral:
    "bg-surface-hover border-line text-fg-muted hover:text-fg hover:bg-line active:bg-line",
};

export default function ActionButton({
  tone = "brand",
  loading = false,
  loadingLabel,
  children,
  fullWidth = true,
  disabled,
  className = "",
  ...rest
}: ActionButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        fullWidth ? "w-full" : "",
        "py-2.5 rounded-xl text-theme-sm font-semibold border",
        "active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        toneMap[tone],
        className,
      ].filter(Boolean).join(" ")}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner size={15} />
          {loadingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
