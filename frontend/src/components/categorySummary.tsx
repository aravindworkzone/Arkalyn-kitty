export default function CategoryDeleteSummary({ category, unit = "expense" }: { category: { name: string; expenseCount: number; color: string }; unit?: "expense" | "credit" }) {
  const { name, expenseCount = 0, color = "#8b5cf6" } = category;
  const isBlocked = expenseCount > 0;
  const noun = unit === "credit" ? "credit" : "expense";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: color + "20", border: `1px solid ${color}40` }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-white/80 leading-tight">{name}</p>
          <p className="text-[10px] text-white/25 mt-0.5">
            {expenseCount > 0
              ? `${expenseCount} ${noun}${expenseCount > 1 ? "s" : ""} tagged`
              : `0 ${noun}s tagged`}
          </p>
        </div>
      </div>

      {isBlocked ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-4 py-3">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/70" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5L13 12.5H1L7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M7 5.5v3M7 10h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <p className="text-[11px] leading-relaxed text-amber-300/60">
            <span className="font-semibold text-amber-300/80">{expenseCount} {noun}{expenseCount > 1 ? "s" : ""}</span> linked to this category. Remove them first before deleting.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5">
          <svg className="h-3.5 w-3.5 shrink-0 text-white/20" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1" />
            <path d="M4.5 7.5l2 2 3-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <p className="text-[11px] text-white/30">No {noun}s linked. Safe to delete.</p>
        </div>
      )}
    </div>
  );
}