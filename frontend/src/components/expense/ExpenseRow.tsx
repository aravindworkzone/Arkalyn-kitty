import type { CSSProperties } from "react";

/**
 * One expense line — used by the group detail feed and the all-expenses list,
 * which had drifted into two near-identical copies of this markup.
 *
 * The category colour stays inline: it is per-category user data, not a theme
 * token. `+"60"` / `+"20"` are alpha suffixes on the stored hex, chosen so the
 * chip stays legible on either canvas.
 */
export interface ExpenseRowItem {
    _id: string;
    title: string;
    amount: number;
    category: { name: string; color: string };
    paidBy?: { name: string };
}

interface Props {
    expense: ExpenseRowItem;
    onSelect: () => void;
    ariaLabel: string;
    /** Trailing line under the amount — a time, a date, nothing. */
    meta?: string;
    style?: CSSProperties;
}

export default function ExpenseRow({ expense, onSelect, ariaLabel, meta, style }: Props) {
    return (
        <div
            onClick={onSelect}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect();
                }
            }}
            aria-label={ariaLabel}
            className="bg-surface-raised border border-line rounded-xl px-5 py-4 shadow-theme-xs
                flex items-center justify-between cursor-pointer transition-colors
                hover:bg-surface-hover hover:border-line-strong
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            style={style}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div
                    className="w-2 h-8 rounded-full shrink-0"
                    style={{
                        background: expense.category.color + "60",
                        boxShadow: `0 0 8px ${expense.category.color}40`,
                    }}
                />
                <div className="min-w-0">
                    <p className="text-theme-sm font-medium text-fg truncate leading-tight" translate="no">
                        {expense.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                            className="text-theme-2xs font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: expense.category.color + "20", color: expense.category.color }}
                            translate="no"
                        >
                            {expense.category.name}
                        </span>
                        <span className="text-theme-2xs text-fg-muted" translate="no">· {expense.paidBy?.name}</span>
                    </div>
                </div>
            </div>
            <div className="text-right shrink-0 ml-3">
                <p className="text-theme-sm font-semibold font-mono text-fg leading-tight" translate="no">
                    ₹{expense.amount?.toLocaleString("en-IN")}
                </p>
                {meta && <p className="text-theme-2xs text-fg-muted mt-0.5" translate="no">{meta}</p>}
            </div>
        </div>
    );
}

/** Loading placeholder matching ExpenseRow's height and rhythm. */
export function ExpenseRowSkeleton() {
    return (
        <div className="bg-surface-raised border border-line rounded-xl px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
                <div className="w-2 h-8 rounded-full bg-line animate-pulse shrink-0" />
                <div className="space-y-1.5 flex-1">
                    <div className="h-3 bg-line rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-surface-hover rounded animate-pulse w-1/3" />
                </div>
            </div>
            <div className="h-4 w-16 bg-line rounded animate-pulse" />
        </div>
    );
}
