import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/header";
import { useGetAllExpensesQuery } from "../redux/api/expense";
import { useGetGroupByIdQuery } from "../redux/api/group";
import ExpenseDetailModal from "../components/ExpenseDetailModal";

const dateLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const timeLabel = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

export default function AllExpensesPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { data: expenses, isLoading } = useGetAllExpensesQuery(groupId!, { skip: !groupId });
  const { data: GroupDetails } = useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const [selectedExpense, setSelectedExpense] = useState<any>(null);

  const role = GroupDetails?.role as string | undefined;

  // group by date label
  const groups: { label: string; items: typeof expenses }[] = [];
  const seen = new Set<string>();
  expenses?.forEach((exp) => {
    const label = dateLabel(exp.date);
    if (!seen.has(label)) {
      seen.add(label);
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1]!.items!.push(exp);
  });

  const total = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-violet-600/4 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.07) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <Header />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/35 hover:text-white/60 text-xs font-medium transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        {/* header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M2 3h10M2 7h7M2 11h4" stroke="#c4b5fd" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/70">All Expenses</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f0eeff]">Expense History</h1>
          <p className="text-white/35 text-sm mt-1">Every expense recorded in this group.</p>
        </div>

        {/* summary bar */}
        {!isLoading && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Total Spent</p>
              <p className="text-[18px] font-semibold font-mono text-[#f0eeff]">
                ₹{total.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Transactions</p>
              <p className="text-[18px] font-semibold font-mono text-[#f0eeff]">
                {expenses?.length ?? 0}
              </p>
            </div>
          </div>
        )}

        {/* skeleton */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, g) => (
              <div key={g} className="space-y-2">
                <div className="h-3 w-20 bg-white/[0.05] rounded animate-pulse" />
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-2 h-8 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 bg-white/[0.06] rounded animate-pulse w-3/4" />
                        <div className="h-2.5 bg-white/[0.04] rounded animate-pulse w-1/3" />
                      </div>
                    </div>
                    <div className="h-4 w-16 bg-white/[0.05] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* empty */}
        {!isLoading && expenses?.length === 0 && (
          <div className="text-center py-16">
            <p className="text-white/20 text-sm">No expenses recorded yet</p>
          </div>
        )}

        {/* grouped list */}
        {!isLoading && groups.map((group, gi) => (
          <div key={group.label} className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
                {group.label}
              </p>
              <p className="text-xs font-mono text-white/30">
                ₹{group.items!.reduce((s, e) => s + e.amount, 0).toLocaleString("en-IN")}
              </p>
            </div>

            {group.items!.map((expense, i) => (
              <div
                key={expense._id}
                onClick={() => setSelectedExpense(expense)}
                className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.12] transition-colors"
                style={{
                  animation: "fadeSlideIn 0.22s ease forwards",
                  animationDelay: `${(gi * 3 + i) * 40}ms`,
                  opacity: 0,
                }}
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
                    <p className="text-[13px] font-medium text-white/80 truncate leading-tight">
                      {expense.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ background: expense.category.color + "20", color: expense.category.color }}
                      >
                        {expense.category.name}
                      </span>
                      <span className="text-[10px] text-white/25">· {expense.paidBy?.name}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <p className="text-[15px] font-semibold font-mono text-[#f0eeff] leading-tight">
                    ₹{expense.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-white/25 mt-0.5">{timeLabel(expense.date)}</p>
                </div>
              </div>
            ))}
          </div>
        ))}

      </main>

      <ExpenseDetailModal expense={selectedExpense} onClose={() => setSelectedExpense(null)} role={role} groupId={groupId} />

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
