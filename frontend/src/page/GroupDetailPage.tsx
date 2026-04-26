import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MemberAvatars from "../components/ListMember";
import Header from "../components/header";

// ── mock data (replace with RTK Query once endpoints are ready) ──
const mockGroup = {
  name: "Monthly Budget",
  displayId: "Grp-26-001",
  role: ["ADMIN"] as const,
  balance: 12500,
  barLength: 74,
  members: ["Aravind", "Karthik", "Priya"],
};

const mockMembers = [
  { _id: "1", name: "Aravind", email: "aravind@mail.com", role: "SUPER_ADMIN", contribution: 5000 },
  { _id: "2", name: "Karthik", email: "karthik@mail.com", role: "ADMIN",       contribution: 4000 },
  { _id: "3", name: "Priya",   email: "priya@mail.com",   role: "MEMBER",      contribution: 3500 },
];

const mockTodayExpenses = [
  { _id: "e1", title: "Lunch",    category: { name: "Food",      color: "#f97316" }, amount: 450,  paidBy: "Aravind", time: "12:30" },
  { _id: "e2", title: "Cab",      category: { name: "Transport", color: "#06b6d4" }, amount: 280,  paidBy: "Karthik", time: "14:15" },
  { _id: "e3", title: "Snacks",   category: { name: "Food",      color: "#f97316" }, amount: 120,  paidBy: "Priya",   time: "16:45" },
];

const roleGrade: Record<string, string> = {
  SUPER_ADMIN: "border-cyan-400/30  bg-cyan-500/10  text-cyan-300",
  ADMIN:       "border-amber-400/30 bg-amber-500/10 text-amber-300",
  MEMBER:      "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

// ── component ────────────────────────────────────────────────────
const GroupDetailPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [membersOpen, setMembersOpen] = useState(false);

  const group = mockGroup;
  const todayTotal = mockTodayExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5  blur-[120px]" />
        <div className="absolute bottom-0  -right-60  w-[600px] h-[600px] rounded-full bg-violet-600/4 blur-[120px]" />
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

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-3">

        {/* Back */}
        <button
          onClick={() => navigate("/groups")}
          className="flex items-center gap-2 text-white/35 hover:text-white/60 text-xs font-medium transition-colors mb-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to groups
        </button>

        {/* ── Zone 1: Hero ── */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          {/* Top row */}
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1.5">
              <h1 className="text-[17px] font-semibold text-[#f0eeff] leading-tight">
                {group.name}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.05] text-white/40">
                  {group.displayId}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${roleGrade[group.role[0]]}`}>
                  {group.role[0]}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">Balance</p>
              <p className="font-mono text-[22px] font-semibold text-[#f0eeff] leading-tight">
                ₹{group.balance.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-white/30">Pool remaining</p>
              <p className="text-[10px] font-mono text-white/40">{group.barLength}%</p>
            </div>
            <div className="w-full h-[3px] bg-white/[0.07] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${group.barLength}%`,
                  background:
                    group.barLength > 60 ? "#818cf8" :
                    group.barLength > 30 ? "#fb923c" : "#f87171",
                }}
              />
            </div>
          </div>

          {/* Avatars */}
          <MemberAvatars members={group.members} />
        </div>

        {/* ── Zone 2: Action buttons ── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: "Add Expense",
              to: `/groups/${groupId}/create-expense`,
              color: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-400/35",
              icon: (
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ),
            },
            {
              label: "Category",
              to: `/groups/${groupId}/create-category`,
              color: "text-violet-300 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-400/35",
              icon: (
                <path d="M2 4h4v4H2zM8 4h4v4H8zM2 10h4v4H2zM8 10h4v4H8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              ),
            },
            {
              label: "Report",
              to: `/groups/${groupId}/report`,
              color: "text-slate-300 bg-slate-500/10 border-slate-500/20 hover:bg-slate-500/20 hover:border-slate-400/35",
              icon: (
                <path d="M2 12V6l4-4h6l2 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              ),
            },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={() => navigate(btn.to)}
              className={`flex flex-col items-center gap-2 py-3.5 rounded-xl border text-[11px] font-semibold transition-all duration-150 ${btn.color}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                {btn.icon}
              </svg>
              {btn.label}
            </button>
          ))}
        </div>

        {/* ── Zone 3: Members (collapsible) ── */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <button
            onClick={() => setMembersOpen((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <MemberAvatars members={group.members} />
              <span className="text-xs font-medium text-white/40">
                {mockMembers.length} members
              </span>
            </div>
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              className={`transition-transform duration-200 ${membersOpen ? "rotate-180" : ""}`}
            >
              <path d="M3 5l4 4 4-4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {membersOpen && (
            <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
              {mockMembers.map((member) => (
                <div key={member._id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/20
                      flex items-center justify-center text-[11px] font-bold text-cyan-400 shrink-0">
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white/80 leading-tight">{member.name}</p>
                      <p className="text-[11px] text-white/30">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono text-white/40">
                      ₹{member.contribution.toLocaleString("en-IN")}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${roleGrade[member.role]}`}>
                      {member.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Zone 4: Today's expenses ── */}
        <div>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Today</p>
            {mockTodayExpenses.length > 0 && (
              <p className="text-xs font-mono font-semibold text-white/50">
                ₹{todayTotal.toLocaleString("en-IN")}
              </p>
            )}
          </div>

          {mockTodayExpenses.length === 0 ? (
            <p className="text-center text-white/25 text-xs py-6">
              No expenses recorded today
            </p>
          ) : (
            <div className="space-y-2">
              {mockTodayExpenses.map((expense, i) => (
                <div
                  key={expense._id}
                  className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5
                    flex items-center justify-between"
                  style={{
                    animation: "fadeSlideIn 0.25s ease forwards",
                    animationDelay: `${i * 50}ms`,
                    opacity: 0,
                  }}
                >
                  {/* Left — category + title */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2 h-8 rounded-full shrink-0"
                      style={{ background: expense.category.color + "60",
                               boxShadow: `0 0 8px ${expense.category.color}40` }}
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
                        <span className="text-[10px] text-white/25">· {expense.paidBy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right — amount + time */}
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[15px] font-semibold font-mono text-[#f0eeff] leading-tight">
                      ₹{expense.amount.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-white/25 mt-0.5">{expense.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default GroupDetailPage;