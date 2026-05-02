export default function ExpenseDeleteSummary({ expense } : { expense : { title: string; amount: number; date: Date; paymentType: "cash" | "card" | "online"; splitBetween: { name: string; userId: string }[] } }) {
  const { title, amount = 0, date, paymentType, splitBetween = [] } = expense;

  const formattedDate = date
    ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const memberNames = splitBetween.map((m) => m.name ?? m).join(", ");

  const paymentLabel = { cash: "Cash", card: "Card", online: "Online" };

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[13px] font-semibold text-white/80">{title}</p>
          <span className="text-[13px] font-semibold text-red-400/80">₹{amount.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[10px] text-white/25">{formattedDate}</span>
          {paymentType && <span className="text-[10px] text-white/25">{paymentLabel[paymentType] ?? paymentType}</span>}
          {memberNames && <span className="text-[10px] text-white/25">Split: {memberNames}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5">
        <svg className="h-3.5 w-3.5 shrink-0 text-white/20" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1" />
          <path d="M4.5 7.5l2 2 3-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <p className="text-[11px] text-white/30">
          Deleting restores <span className="text-white/50 font-medium">₹{amount.toLocaleString("en-IN")}</span> to the group pool
        </p>
      </div>
    </div>
  );
}