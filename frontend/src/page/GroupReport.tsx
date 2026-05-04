import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/header";
import { useGetTransactionQuery, useGetEventQuery } from "../redux/api/group";

// ── mock data ──────────────────────────────────────────────────
const mockTransactions = [
  { _id: "t1", action: "CREDIT", amount: 5000, description: "Initial contribution", performedBy: "Aravind", referenceModel: "Group",  createdAt: "26 Apr 2026, 10:00" },
  { _id: "t2", action: "DEBIT",  amount: 450,  description: "Expense: Lunch",       performedBy: "Aravind", referenceModel: "Expense", createdAt: "26 Apr 2026, 12:30" },
  { _id: "t3", action: "DEBIT",  amount: 280,  description: "Expense: Cab",         performedBy: "Aravind", referenceModel: "Expense", createdAt: "26 Apr 2026, 14:15" },
  { _id: "t4", action: "REFUND", amount: 280,  description: "Refund: Cab deleted",  performedBy: "Aravind", referenceModel: "Expense", createdAt: "26 Apr 2026, 15:00" },
];

const mockEvents = [
  { _id: "e1", eventType: "CREATE_GROUP",    performedBy: "Aravind", metadata: { groupName: "Monthly Budget" },        createdAt: "26 Apr 2026, 09:50" },
  { _id: "e2", eventType: "MEMBER_ADDED",    performedBy: "Aravind", metadata: { memberName: "Aravind" },              createdAt: "26 Apr 2026, 09:51" },
  { _id: "e3", eventType: "MANAGE_CATEGORY", performedBy: "Aravind", metadata: { action: "created", name: "Food" },   createdAt: "26 Apr 2026, 09:55" },
  { _id: "e4", eventType: "CHANGE_ROLE",     performedBy: "Aravind", metadata: { member: "Karthik", role: "ADMIN" },  createdAt: "26 Apr 2026, 10:05" },
  { _id: "e5", eventType: "MEMBER_REMOVED",  performedBy: "Aravind", metadata: { memberName: "Priya" },               createdAt: "26 Apr 2026, 11:00" },
];

// ── helpers ────────────────────────────────────────────────────
const actionStyle: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CREDIT: { label: "Credit", color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
  DEBIT:  { label: "Debit",  color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  REFUND: { label: "Refund", color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
};

const eventConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CREATE_GROUP:    { label: "Group created",    color: "#818cf8", icon: <path d="M2 7h10M7 2v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/> },
  MEMBER_ADDED:    { label: "Member added",     color: "#34d399", icon: <><circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 11c0-2.5 2-4 5-4s5 1.5 5 4M10 6l1.5 1.5L13 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></> },
  MEMBER_REMOVED:  { label: "Member removed",   color: "#f87171", icon: <><circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 11c0-2.5 2-4 5-4s5 1.5 5 4M10 7h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></> },
  MANAGE_CATEGORY: { label: "Category updated", color: "#a78bfa", icon: <path d="M2 3h4v4H2zM8 3h4v4H8zM2 9h4v4H2zM8 9h4v4H8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/> },
  CHANGE_ROLE:     { label: "Role changed",     color: "#fbbf24", icon: <path d="M2 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/> },
};

const eventDescription = (event: typeof mockEvents[0]) => {
  const m = event.metadata || {};
  switch (event.eventType) {
    case "CREATE_GROUP":    return `"${m.groupName}" was created`;
    case "MEMBER_ADDED":    return `${m.memberName} was added to the group`;
    case "MEMBER_REMOVED":  return `${m.memberName} was removed`;
    case "MANAGE_CATEGORY": return `Category "${m.referenceId.name}" was ${m.action}`;
    case "CHANGE_ROLE":     return `${m.member}'s role changed to ${m.role}`;
    default: return "Group activity";
  }
};

// ── component ──────────────────────────────────────────────────
export default function ReportPage() {
  const { groupId } = useParams();
  const navigate    = useNavigate();
  const [tab, setTab]           = useState<"transactions" | "events">("transactions");
  const [txFilter, setTxFilter] = useState<"ALL" | "CREDIT" | "DEBIT" | "REFUND">("ALL");
  const { data: Transactions, isLoading } = useGetTransactionQuery(groupId || "", { refetchOnMountOrArgChange: true });
  const { data: Events } = useGetEventQuery(groupId || "", { refetchOnMountOrArgChange: true });

  const filteredTx = txFilter === "ALL"
    ? Transactions
    : Transactions?.filter((t: any) => t.action === txFilter);

  const totalCredit = Transactions?.filter((t: any) => t.action === "CREDIT").reduce((s: number, t: any) => s + t.amount, 0);
  const totalDebit  = Transactions?.filter((t: any) => t.action === "DEBIT").reduce((s: number, t: any) => s + t.amount, 0);
  const totalRefund = Transactions?.filter((t: any) => t.action === "REFUND").reduce((s: number, t: any) => s + t.amount, 0);

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-violet-600/4 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.07) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <Header />

      <div className="relative max-w-2xl mx-auto px-4 py-10 space-y-4">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/35 hover:text-white/60 text-xs font-medium transition-colors mb-4"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M2 12V6l4-4h6l2 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" stroke="#a5b4fc" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70">Report</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f0eeff]">Group report</h1>
          <p className="text-white/35 text-sm mt-1.5">Transactions and activity log for this group.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Total In",    value: totalCredit, color: "#34d399" },
            { label: "Total Out",   value: totalDebit,  color: "#f87171" },
            { label: "Refunds",     value: totalRefund, color: "#fbbf24" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{stat.label}</p>
              <p className="text-[16px] font-semibold font-mono" style={{ color: stat.color }}>
                ₹{stat.value?.toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl">
          {(["transactions", "events"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150 capitalize ${
                tab === t
                  ? "bg-white/[0.08] text-white/80 shadow-sm"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              {t === "transactions" ? "Transactions" : "Activity Log"}
            </button>
          ))}
        </div>

        {tab === "transactions" && (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {(["ALL", "CREDIT", "DEBIT", "REFUND"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all duration-150 ${
                    txFilter === f
                      ? "bg-white/[0.1] border-white/[0.2] text-white/80"
                      : "bg-white/[0.03] border-white/[0.07] text-white/30 hover:bg-white/[0.06]"
                  }`}
                >
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
              {filteredTx?.length === 0 ? (
                <p className="text-center text-white/20 text-xs py-10">No transactions found</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {filteredTx?.map((tx: any, i: any) => {
                    const style = actionStyle[tx.action];
                    return (
                      <div
                        key={tx._id}
                        className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
                        style={{ animation: "fadeSlideIn 0.2s ease forwards", animationDelay: `${i * 40}ms`, opacity: 0 }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-bold border"
                            style={{ background: style.bg, borderColor: style.border, color: style.color }}
                          >
                            {tx.action === "CREDIT" ? "↑" : tx.action === "DEBIT" ? "↓" : "↺"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-white/75 truncate leading-tight">
                              {tx.description}
                            </p>
                            <p className="text-[10px] text-white/25 mt-0.5">
                              {tx.performedBy.name} · {tx.createdAt}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-3">
                          <p
                            className="text-[14px] font-semibold font-mono"
                            style={{ color: style.color }}
                          >
                            {tx.action === "DEBIT" ? "-" : "+"}₹{tx.amount.toLocaleString("en-IN")}
                          </p>
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border"
                            style={{ background: style.bg, borderColor: style.border, color: style.color }}
                          >
                            {style.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "events" && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            {Events?.length === 0 ? (
              <p className="text-center text-white/20 text-xs py-10">No activity yet</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[42px] top-0 bottom-0 w-px bg-white/[0.05]" />

                <div className="divide-y divide-white/[0.04]">
                  {Events.map((event: any, i: any) => {
                    const cfg = eventConfig[event.eventType];
                    return (
                      <div
                        key={event._id}
                        className="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors relative"
                        style={{ animation: "fadeSlideIn 0.2s ease forwards", animationDelay: `${i * 40}ms`, opacity: 0 }}
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border relative z-10"
                          style={{
                            background: cfg.color + "18",
                            borderColor: cfg.color + "40",
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: cfg.color }}>
                            {cfg.icon}
                          </svg>
                        </div>

                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[13px] font-medium text-white/75 leading-tight">
                            {eventDescription(event)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border"
                              style={{ background: cfg.color + "15", borderColor: cfg.color + "35", color: cfg.color }}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-[10px] text-white/25">
                              by {event.performedBy.name} · {event.createdAt}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}