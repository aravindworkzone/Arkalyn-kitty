export default function GroupDeleteSummary({ group } : { group: {name: string, members: string[], balance: number, expenseCount: number }}) {
  const { name, members = [], balance = 0, expenseCount = 0 } = group;

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
        <p className="text-[13px] font-semibold text-white/80 leading-tight mb-2">{name}</p>
        <div className="flex gap-4">
          <span className="text-[10px] text-white/25">{members.length} member{members.length !== 1 ? "s" : ""}</span>
          <span className="text-[10px] text-white/25">{expenseCount} expense{expenseCount !== 1 ? "s" : ""}</span>
          <span className="text-[10px] text-white/25">Pool ₹{balance.toLocaleString("en-IN")}</span>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-4 py-3">
        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400/60" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.5L13 12.5H1L7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M7 5.5v3M7 10h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <p className="text-[11px] leading-relaxed text-red-300/50">
          Permanently removes all members, categories, and expenses. Pool balance of{" "}
          <span className="font-semibold text-red-300/70">₹{balance.toLocaleString("en-IN")}</span> will be lost.
        </p>
      </div>
    </div>
  );
}