export default function CategoryDeleteSummary({ category, unit = "expense" }: { category: { name: string; expenseCount: number; color: string }; unit?: "expense" | "credit" }) {
  const { name, expenseCount = 0, color = "#465fff" } = category;
  const isBlocked = expenseCount > 0;
  const noun = unit === "credit" ? "credit" : "expense";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised px-5 py-3.5">
        {/* The category's own stored colour — user data, so it stays inline. */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: color + "20", border: `1px solid ${color}40` }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        </div>
        <div>
          <p className="text-theme-sm font-semibold text-fg leading-tight">{name}</p>
          <p className="text-theme-2xs text-fg-muted mt-0.5">
            {expenseCount > 0
              ? `${expenseCount} ${noun}${expenseCount > 1 ? "s" : ""} tagged`
              : `0 ${noun}s tagged`}
          </p>
        </div>
      </div>

      {isBlocked ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50 dark:border-warning-500/15 dark:bg-warning-500/[0.06] px-5 py-3.5">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-600 dark:text-warning-400" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1.5L13 12.5H1L7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M7 5.5v3M7 10h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <p className="text-theme-xs leading-relaxed text-warning-700 dark:text-warning-300/60">
            <span className="font-semibold text-warning-800 dark:text-warning-300/80">{expenseCount} {noun}{expenseCount > 1 ? "s" : ""}</span> linked to this category. Remove them first before deleting.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-raised px-4 py-2.5">
          <svg className="h-3.5 w-3.5 shrink-0 text-fg-muted" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1" />
            <path d="M4.5 7.5l2 2 3-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <p className="text-theme-xs text-fg-muted">No {noun}s linked. Safe to delete.</p>
        </div>
      )}
    </div>
  );
}
