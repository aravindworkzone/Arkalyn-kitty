import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MemberAvatars from "../components/ListMember";
import Header from "../components/header";
import DeleteConfirmModal from "../components/deleteModel";
import ExpenseDetailModal from "../components/ExpenseDetailModal";
import { useGetExpenseReportQuery } from "../redux/api/expense";
import { useGetCategoriesQuery } from "../redux/api/category";
import {
  useGetGroupMembersQuery,
  useGetGroupByIdQuery,
} from "../redux/api/group";
import { useGroupDetailHandlers } from "../handlers/useGroupDetailHandlers";
import { roleGrade } from "../helpers/constants";
import type { SettingsTab } from "../interface/group";
const inp =
  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 transition-all";

// ── component ────────────────────────────────────────────────────
export default function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  // ── panel toggles
  const [membersOpen, setMembersOpen]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab]                   = useState<SettingsTab>("addMember");
  // ── add member form
  const [searchEmail,   setSearchEmail]   = useState("");
  const [foundUser,     setFoundUser]     = useState<{ _id: string; name: string } | null>(null);
  const [memberContrib, setMemberContrib] = useState("");

  // ── change role form
  const [roleMemberId, setRoleMemberId] = useState("");
  const [roleAction,   setRoleAction]   = useState<"promote" | "demote">("promote");

  // ── contribution form
  const [myContrib,       setMyContrib]       = useState("");
  const [contribMemberId, setContribMemberId] = useState("");

  // ── settlement form
  const [settleMemberId, setSettleMemberId] = useState("");
  const [settleAmount,   setSettleAmount]   = useState("");

  // ── delete member modal
  const [deleteMemberTarget, setDeleteMemberTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteMemberError,  setDeleteMemberError]  = useState("");

  // ── delete group modal
  const [deleteGroupOpen,  setDeleteGroupOpen]  = useState(false);
  const [deleteGroupError, setDeleteGroupError] = useState("");

  // ── expense detail modal
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [noCatAlert,      setNoCatAlert]      = useState(false);

  // ── queries
  const { data: GroupDetails, isLoading: groupLoading } =
    useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const { data: TodayExpenses } =
    useGetExpenseReportQuery(groupId!, { skip: !groupId });
  const { data: GroupMembers } =
    useGetGroupMembersQuery(groupId!, { skip: !groupId });
  const { data: categories = [] } =
    useGetCategoriesQuery(groupId!, { skip: !groupId });

  // ── handlers + mutations
  const {
    msg, setMsg,
    isVerifying, isAddingMember, isChangingRole,
    isAddingContrib, isSettling, isDeletingGroup, isRemovingMember,
    handleVerifyUser, handleAddMember, handleChangeRole,
    handleAddContribution, handleSettlement, handleDeleteMember, handleDeleteGroup,
  } = useGroupDetailHandlers(groupId);

  const memberNames   = GroupMembers?.map((m) => m.userId.name) ?? [];
  const todayTotal    = (TodayExpenses ?? []).reduce((s, e) => s + e.amount, 0);
  const totalContrib  = GroupDetails?.totalContribution ?? 0;

  const role        = GroupDetails?.role as string | undefined;
  const isAdmin     = role === "SUPER_ADMIN" || role === "ADMIN";
  const isSuperAdmin = role === "SUPER_ADMIN";

  const switchTab = (t: SettingsTab) => { setTab(t); setMsg(null); };

  const openSettings = () => {
    setSettingsOpen(true);
    setMsg(null);
    setTab("addMember");
    setFoundUser(null); setSearchEmail(""); setMemberContrib("");
    setRoleMemberId(""); setRoleAction("promote");
    setMyContrib(""); setContribMemberId("");
    setSettleMemberId(""); setSettleAmount("");
  };

  // ── tabs config ───────────────────────────────────────────────────
  const settingsTabs: { id: SettingsTab; label: string; show: boolean }[] = [
    { id: "addMember",    label: "Add Member",   show: isAdmin },
    { id: "changeRole",   label: "Change Role",  show: isSuperAdmin },
    { id: "contribution", label: "Contribution", show: isAdmin },
    { id: "settlement",   label: "Settlement",   show: isAdmin },
    { id: "danger",       label: "Danger",       show: isSuperAdmin },
  ];

  if (groupLoading) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
          <div className="absolute bottom-0 -right-60 w-[600px] h-[600px] rounded-full bg-violet-600/4 blur-[120px]" />
        </div>
        <Header />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4 animate-pulse">
          {/* back */}
          <div className="h-4 w-12 bg-white/[0.05] rounded" />
          {/* hero card */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-3 w-24 bg-white/[0.06] rounded" />
                <div className="h-6 w-48 bg-white/[0.07] rounded" />
                <div className="h-3 w-32 bg-white/[0.04] rounded" />
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/[0.05]" />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 space-y-2">
                  <div className="h-2.5 w-12 bg-white/[0.05] rounded" />
                  <div className="h-5 w-16 bg-white/[0.07] rounded" />
                </div>
              ))}
            </div>
          </div>
          {/* expense rows */}
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white">

      {/* ambient background */}
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

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-3">

        {/* back */}
        <button
          onClick={() => navigate("/groups")}
          className="flex items-center gap-2 text-white/35 hover:text-white/60 text-xs font-medium transition-colors mb-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to groups
        </button>

        {/* ── Group card ── */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          {/* name + balance row */}
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1.5">
              <h1 className="text-[17px] font-semibold text-[#f0eeff] leading-tight">
                {GroupDetails?.name}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.05] text-white/40">
                  {GroupDetails?.displayId}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${roleGrade[role || "MEMBER"]}`}>
                  {role}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">Balance</p>
              <p className="font-mono text-[22px] font-semibold text-[#f0eeff] leading-tight">
                ₹{GroupDetails?.balance?.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] font-mono text-white/25 mt-0.5">
                of ₹{totalContrib.toLocaleString("en-IN")} contributed
              </p>
            </div>
          </div>

          {/* pool bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-white/30">Pool remaining</p>
              <p className="text-[10px] font-mono text-white/40">{GroupDetails?.barLength}%</p>
            </div>
            <div className="w-full h-[3px] bg-white/[0.07] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${GroupDetails?.barLength}%`,
                  background:
                    (GroupDetails?.barLength ?? 0) > 60 ? "#818cf8" :
                    (GroupDetails?.barLength ?? 0) > 30 ? "#fb923c" : "#f87171",
                }}
              />
            </div>
          </div>

          <MemberAvatars members={memberNames} />
        </div>

        {/* ── No-category alert ── */}
        {noCatAlert && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1l6 11H1L7 1z" stroke="#fbbf24" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M7 5.5v3M7 9.5h.01" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-amber-300 leading-tight">No categories yet</p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">Create a category before adding an expense.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate(`/groups/${groupId}/create-category`)}
                className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setNoCatAlert(false)}
                className="text-amber-500/60 hover:text-amber-400 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className={`grid gap-2 ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
          {[
            {
              label: "Add Expense",
              onClick: () => {
                if (categories.length === 0) { setNoCatAlert(true); return; }
                navigate(`/groups/${groupId}/create-expense`);
              },
              color: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-400/35",
              icon: <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
              show: true,
            },
            {
              label: "Category",
              onClick: () => navigate(`/groups/${groupId}/create-category`),
              color: "text-violet-300 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-400/35",
              icon: <path d="M2 4h4v4H2zM8 4h4v4H8zM2 10h4v4H2zM8 10h4v4H8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />,
              show: isAdmin,
            },
            {
              label: "Report",
              onClick: () => navigate(`/groups/${groupId}/report`),
              color: "text-slate-300 bg-slate-500/10 border-slate-500/20 hover:bg-slate-500/20 hover:border-slate-400/35",
              icon: <path d="M2 12V6l4-4h6l2 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />,
              show: true,
            },
            ...(isAdmin ? [{
              label: "Settings",
              onClick: openSettings,
              color: "text-amber-300 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-400/35",
              show: true,
              icon: (
                <>
                  <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.6 2.6l1 1M9.4 9.4l1 1M2.6 11.4l1-1M9.4 4.6l1-1"
                    stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </>
              ),
            }] : []),
          ].filter((btn) => btn.show).map((btn) => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              className={`flex flex-col items-center gap-2 py-3.5 rounded-xl border text-[11px] font-semibold transition-all duration-150 ${btn.color}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                {btn.icon}
              </svg>
              {btn.label}
            </button>
          ))}
        </div>

        {/* ── Members accordion ── */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <button
            onClick={() => setMembersOpen((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <MemberAvatars members={memberNames} />
              <span className="text-xs font-medium text-white/40">
                {GroupMembers?.length ?? 0} members
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
            <div className="border-t border-white/[0.06]">

              {/* contribution breakdown header */}
              <div className="px-5 py-3 border-b border-white/[0.04] bg-white/[0.015]">
                <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2.5">Contributions</p>
                <div className="space-y-2">
                  {GroupMembers?.map((m) => {
                    const pct = totalContrib > 0 ? Math.round((m.contribution / totalContrib) * 100) : 0;
                    return (
                      <div key={m._id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-white/50">{m.userId.name}</span>
                          <span className="text-[11px] font-mono text-white/40">
                            ₹{m.contribution.toLocaleString("en-IN")}
                            <span className="text-white/20 ml-1">({pct}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-[2px] bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: roleGrade[m.role]?.match(/text-(\S+)-300/)?.[0] ? "#818cf8" : "#818cf8" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* member list */}
              <div className="divide-y divide-white/[0.04]">
                {GroupMembers?.map((member) => (
                  <div key={member._id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/20
                        flex items-center justify-center text-[11px] font-bold text-cyan-400 shrink-0">
                        {member.userId.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-white/80 leading-tight">{member.userId.name}</p>
                        <p className="text-[11px] text-white/30 truncate">{member.userId.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-[11px] font-mono text-white/40">
                          ₹{member.contribution.toLocaleString("en-IN")}
                        </p>
                        {member.settlement && (
                          <p className="text-[9px] text-green-400/70 font-semibold">SETTLED</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${roleGrade[member.role]}`}>
                        {member.role === "SUPER_ADMIN" ? "S.ADMIN" : member.role}
                      </span>
                      {/* delete — only admins can remove non-super-admins */}
                      {isAdmin && member.role !== "SUPER_ADMIN" && (
                        <button
                          onClick={() => setDeleteMemberTarget({ id: member.userId._id, name: member.userId.name })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/20
                            hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove member"
                        >
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M2 3h8M5 3V2h2v1M4.5 3l.5 6.5M7.5 3l-.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Today's expenses ── */}
        <div>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Today</p>
            <div className="flex items-center gap-3">
              {(TodayExpenses?.length ?? 0) > 0 && (
                <p className="text-xs font-mono font-semibold text-white/50">
                  ₹{todayTotal.toLocaleString("en-IN")}
                </p>
              )}
              <button
                onClick={() => navigate(`/groups/${groupId}/expenses`)}
                className="text-[10px] font-semibold text-violet-400/70 hover:text-violet-300 transition-colors flex items-center gap-1"
              >
                View all
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {(TodayExpenses?.length ?? 0) === 0 ? (
            <div
              onClick={() => navigate(`/groups/${groupId}/expenses`)}
              className="text-center text-white/25 text-xs py-6 cursor-pointer hover:text-white/40 transition-colors"
            >
              No expenses today — tap to view full history
            </div>
          ) : (
            <div className="space-y-2">
              {TodayExpenses?.map((expense, i) => (
                <div
                  key={expense._id}
                  onClick={() => setSelectedExpense(expense)}
                  className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5
                    flex items-center justify-between cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.12] transition-colors"
                  style={{
                    animation: "fadeSlideIn 0.25s ease forwards",
                    animationDelay: `${i * 50}ms`,
                    opacity: 0,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2 h-8 rounded-full shrink-0"
                      style={{ background: expense.category.color + "60", boxShadow: `0 0 8px ${expense.category.color}40` }}
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
                      ₹{expense?.amount?.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-white/25 mt-0.5">{expense.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* ── Group Settings bottom sheet ───────────────────────────── */}
      {settingsOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
            <div className="w-full max-w-2xl pointer-events-auto bg-[#0d1220]
              border border-white/[0.08] border-b-0 rounded-t-2xl
              shadow-[0_-8px_40px_rgba(0,0,0,0.5)]">

              {/* drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-white/10" />
              </div>

              {/* header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <p className="text-sm font-semibold text-white/70">Group Settings</p>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg
                    bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* tabs */}
              <div className="flex border-b border-white/[0.06] overflow-x-auto px-4 pt-2 gap-1" style={{ scrollbarWidth: "none" }}>
                {settingsTabs.filter((t) => t.show).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => switchTab(t.id)}
                    className={`px-3.5 pb-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2
                      ${tab === t.id
                        ? t.id === "danger"
                          ? "text-red-400 border-red-500"
                          : "text-cyan-300 border-cyan-400"
                        : "text-white/35 border-transparent hover:text-white/55"
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* content */}
              <div className="px-5 py-4 max-h-[55vh] overflow-y-auto space-y-3">

                {/* feedback */}
                {msg && (
                  <div className={`text-xs px-3.5 py-2.5 rounded-xl border ${
                    msg.ok
                      ? "text-green-400 bg-green-500/10 border-green-500/20"
                      : "text-red-400 bg-red-500/10 border-red-500/20"
                  }`}>
                    {msg.text}
                  </div>
                )}

                {/* ─ Add Member ─ */}
                {tab === "addMember" && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleVerifyUser(searchEmail, setFoundUser)}
                        placeholder="member@email.com"
                        className={`${inp} flex-1`}
                      />
                      <button
                        onClick={() => handleVerifyUser(searchEmail, setFoundUser)}
                        disabled={isVerifying || !searchEmail.trim()}
                        className="px-4 rounded-xl text-xs font-semibold border
                          bg-white/[0.04] border-white/[0.09] text-white/50
                          hover:text-white/80 hover:bg-white/[0.07] disabled:opacity-40 transition-all"
                      >
                        {isVerifying ? "…" : "Find"}
                      </button>
                    </div>
                    {foundUser && (
                      <>
                        <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/20
                            flex items-center justify-center text-[11px] font-bold text-cyan-400 shrink-0">
                            {foundUser.name.slice(0, 2).toUpperCase()}
                          </div>
                          <p className="text-sm text-white/70">{foundUser.name}</p>
                        </div>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">₹</span>
                          <input
                            type="number"
                            value={memberContrib}
                            onChange={(e) => setMemberContrib(e.target.value)}
                            placeholder="Initial contribution (optional)"
                            className={`${inp} pl-8`}
                            min="0"
                          />
                        </div>
                        <button
                          onClick={() => handleAddMember(foundUser, memberContrib, setFoundUser, setSearchEmail, setMemberContrib)}
                          disabled={isAddingMember}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold
                            bg-cyan-500/15 border border-cyan-500/25 text-cyan-300
                            hover:bg-cyan-500/25 disabled:opacity-40 transition-all"
                        >
                          {isAddingMember ? "Adding…" : "Add Member"}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* ─ Change Role ─ */}
                {tab === "changeRole" && (
                  <div className="space-y-3">
                    <select
                      value={roleMemberId}
                      onChange={(e) => setRoleMemberId(e.target.value)}
                      className={`${inp} appearance-none`}
                      style={{ background: "#0d1220" }}
                    >
                      <option value="" disabled>Select member</option>
                      {GroupMembers?.filter((m) => m.role !== "SUPER_ADMIN").map((m) => (
                        <option key={m._id} value={m.userId._id} style={{ background: "#0d1220" }}>
                          {m.userId.name} · {m.role === "ADMIN" ? "Admin" : "Member"}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      {(["promote", "demote"] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => setRoleAction(a)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all
                            ${roleAction === a
                              ? a === "promote"
                                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                : "bg-slate-500/15 border-slate-500/30 text-slate-300"
                              : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"
                            }`}
                        >
                          {a === "promote" ? "Promote to Admin" : "Demote to Member"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleChangeRole(roleMemberId, roleAction, setRoleMemberId)}
                      disabled={!roleMemberId || isChangingRole}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold
                        bg-amber-500/15 border border-amber-500/25 text-amber-300
                        hover:bg-amber-500/25 disabled:opacity-40 transition-all"
                    >
                      {isChangingRole ? "Updating…" : "Change Role"}
                    </button>
                  </div>
                )}

                {/* ─ Add Contribution ─ */}
                {tab === "contribution" && (
                  <div className="space-y-3">
                    <p className="text-xs text-white/30">Add funds to the group pool. Select a member or leave as self.</p>
                    <select
                      value={contribMemberId}
                      onChange={(e) => setContribMemberId(e.target.value)}
                      className={`${inp} appearance-none`}
                      style={{ background: "#0d1220" }}
                    >
                      <option value="" style={{ background: "#0d1220" }}>My contribution (self)</option>
                      {GroupMembers?.map((m) => (
                        <option key={m._id} value={m.userId._id} style={{ background: "#0d1220" }}>
                          {m.userId.name} · ₹{m.contribution.toLocaleString("en-IN")} current
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">₹</span>
                      <input
                        type="number"
                        value={myContrib}
                        onChange={(e) => setMyContrib(e.target.value)}
                        placeholder="Amount"
                        className={`${inp} pl-8`}
                        min="1"
                      />
                    </div>
                    <button
                      onClick={() => handleAddContribution(myContrib, contribMemberId, setMyContrib, setContribMemberId)}
                      disabled={!myContrib || Number(myContrib) <= 0 || isAddingContrib}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold
                        bg-violet-500/15 border border-violet-500/25 text-violet-300
                        hover:bg-violet-500/25 disabled:opacity-40 transition-all"
                    >
                      {isAddingContrib ? "Adding…" : "Add Contribution"}
                    </button>
                  </div>
                )}

                {/* ─ Settlement ─ */}
                {tab === "settlement" && (
                  <div className="space-y-3">
                    <select
                      value={settleMemberId}
                      onChange={(e) => setSettleMemberId(e.target.value)}
                      className={`${inp} appearance-none`}
                      style={{ background: "#0d1220" }}
                    >
                      <option value="" disabled>Select member to settle</option>
                      {GroupMembers?.filter((m) => !m.settlement).map((m) => (
                        <option key={m._id} value={m.userId._id} style={{ background: "#0d1220" }}>
                          {m.userId.name} · ₹{m.contribution.toLocaleString("en-IN")}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">₹</span>
                      <input
                        type="number"
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                        placeholder="Settlement amount"
                        className={`${inp} pl-8`}
                        min="1"
                      />
                    </div>
                    <button
                      onClick={() => handleSettlement(settleMemberId, settleAmount, setSettleMemberId, setSettleAmount)}
                      disabled={!settleMemberId || !settleAmount || Number(settleAmount) <= 0 || isSettling}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold
                        bg-green-500/15 border border-green-500/25 text-green-300
                        hover:bg-green-500/25 disabled:opacity-40 transition-all"
                    >
                      {isSettling ? "Settling…" : "Settle Member"}
                    </button>
                  </div>
                )}

                {/* ─ Danger Zone ─ */}
                {tab === "danger" && (
                  <div className="space-y-3">
                    <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl px-4 py-4">
                      <p className="text-xs font-semibold text-red-400 mb-1">Delete Group</p>
                      <p className="text-[11px] text-white/30 mb-3">
                        Permanently deletes the group. This cannot be undone.
                      </p>
                      <button
                        onClick={() => { setSettingsOpen(false); setDeleteGroupOpen(true); }}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold
                          bg-red-500/10 border border-red-500/20 text-red-400
                          hover:bg-red-500/20 transition-all"
                      >
                        Delete Group
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Member modal ── */}
      <DeleteConfirmModal
        isOpen={!!deleteMemberTarget}
        onClose={() => { setDeleteMemberTarget(null); setDeleteMemberError(""); }}
        onConfirm={() => handleDeleteMember(deleteMemberTarget, setDeleteMemberTarget, setDeleteMemberError)}
        label={`Remove ${deleteMemberTarget?.name ?? ""}`}
        confirmText="REMOVE"
        isLoading={isRemovingMember}
        error={deleteMemberError}
      >
        <p className="text-sm text-white/50">
          Remove <span className="text-white/80 font-medium">{deleteMemberTarget?.name}</span> from
          the group? Member must be settled before removal.
        </p>
      </DeleteConfirmModal>

      {/* ── Delete Group modal ── */}
      <DeleteConfirmModal
        isOpen={deleteGroupOpen}
        onClose={() => { setDeleteGroupOpen(false); setDeleteGroupError(""); }}
        onConfirm={() => handleDeleteGroup(setDeleteGroupError)}
        label="Delete Group"
        confirmText="DELETE"
        isLoading={isDeletingGroup}
        error={deleteGroupError}
      >
        <p className="text-sm text-white/50">
          Permanently delete{" "}
          <span className="text-white/80 font-medium">{GroupDetails?.name}</span>?
          All data will be lost.
        </p>
      </DeleteConfirmModal>

      {/* ── Expense detail modal ── */}
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
