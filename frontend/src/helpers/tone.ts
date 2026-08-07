/**
 * Status tones as class strings.
 *
 * The ledger and activity feed used to carry literal hex/rgba in inline styles
 * (`{ color: "#34d399", bg: "rgba(52,211,153,0.1)" }`). Inline styles cannot
 * respond to `.dark`, so those colours were pinned to whatever read well on the
 * dark canvas and washed out on the light one. As classes they flip with the
 * theme, and the status vocabulary stays in one place.
 *
 * These are the RESERVED status colours — never reuse them as chart series
 * colours. Series identity comes from helpers/chartPalette.ts.
 */
export type Tone = "brand" | "success" | "warning" | "error" | "info" | "neutral";

/** Filled chip: background + border + text, for badges and icon tiles. */
export const toneChip: Record<Tone, string> = {
  brand:
    "bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500/25 dark:text-brand-300",
  success:
    "bg-success-50 border-success-200 text-success-700 dark:bg-success-500/10 dark:border-success-500/25 dark:text-success-300",
  warning:
    "bg-warning-50 border-warning-200 text-warning-800 dark:bg-warning-500/10 dark:border-warning-500/25 dark:text-warning-300",
  error:
    "bg-error-50 border-error-200 text-error-700 dark:bg-error-500/10 dark:border-error-500/25 dark:text-error-300",
  info:
    "bg-blue-light-500/10 border-blue-light-500/25 text-blue-light-600 dark:text-blue-light-500",
  neutral: "bg-surface-hover border-line text-fg-muted",
};

/** Text only — amounts and values that carry the tone without a chip. */
export const toneText: Record<Tone, string> = {
  brand: "text-brand-600 dark:text-brand-400",
  success: "text-success-700 dark:text-success-400",
  warning: "text-warning-700 dark:text-warning-400",
  error: "text-error-600 dark:text-error-400",
  info: "text-blue-light-600 dark:text-blue-light-500",
  neutral: "text-fg-muted",
};
