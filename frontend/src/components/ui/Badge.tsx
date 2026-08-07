import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../helpers/cn";

/**
 * Design-system badge (UI_PROMPT .badge).
 *
 * Status is ALWAYS shown as a badge, never as raw coloured text — that rule is
 * why this exists. Semantic mapping from the doc:
 *   success -> active / approved / paid / completed
 *   warning -> pending / on-hold / draft / expiring
 *   error   -> rejected / locked / overdue / closed
 *   brand   -> plan tiers, counts, neutral emphasis
 *   gray    -> everything unremarkable
 */

export type BadgeTone = "success" | "warning" | "error" | "brand" | "gray";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: BadgeTone;
    children: ReactNode;
}

const toneClass: Record<BadgeTone, string> = {
    success: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
    warning: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
    error: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400",
    gray: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-400",
};

export default function Badge({ tone = "gray", className, children, ...rest }: BadgeProps) {
    return (
        <span
            {...rest}
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-theme-xs font-medium",
                toneClass[tone],
                className
            )}
        >
            {children}
        </span>
    );
}
