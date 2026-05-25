import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MemberAvatars from "../components/ListMember";
import Header from "../components/header";
import DeleteConfirmModal from "../components/deleteModel";
import CloseGroupModal from "../components/CloseGroupModal";
import ExpenseDetailModal from "../components/ExpenseDetailModal";
import { useGetExpenseReportQuery } from "../redux/api/expense";
import { useGetCategoriesQuery } from "../redux/api/category";
import {
  useGetGroupMembersQuery,
  useGetGroupByIdQuery,
  useGetLeftContributorsQuery,
} from "../redux/api/group";
import { useGetUserQuery } from "../redux/api/auth";
import { useGroupDetailHandlers } from "../handlers/useGroupDetailHandlers";
import { roleGrade, roleLabel } from "../helpers/constants";
import type { SettingsTab } from "../interface/group";
import { StatusBanner } from "../components/ui";
import {
  SettingsAddMember,
  SettingsChangeRole,
  SettingsContribution,
  SettingsSettlement,
  SettingsLeaveRequests,
  SettingsDangerZone,
} from "../components/groupSettings";
import { useTranslation } from "react-i18next";
import { joinGroup } from "../socket/emiter/group.emit";
import { setGroupId } from "../redux/slice/group.slice";
import { setTourGroupBalance } from "../store/tourStore";
import { useDispatch } from "react-redux";

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dispatch = useDispatch();

  useEffect(() => {

    if (!groupId) return;
    dispatch(setGroupId(groupId));

    joinGroup(groupId);

  }, [groupId]);

  const [membersOpen, setMembersOpen]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab]                   = useState<SettingsTab>("addMember");
  const [deleteMemberTarget, setDeleteMemberTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteMemberError,  setDeleteMemberError]  = useState("");
  const [deleteGroupOpen,  setDeleteGroupOpen]  = useState(false);
  const [deleteGroupError, setDeleteGroupError] = useState("");
  const [leaveGroupOpen,   setLeaveGroupOpen]   = useState(false);
  const [leaveGroupError,  setLeaveGroupError]  = useState("");
  const [leaveRequestSent, setLeaveRequestSent] = useState(false);
  const [forfeitLeaveOpen,  setForfeitLeaveOpen]  = useState(false);
  const [forfeitLeaveError, setForfeitLeaveError] = useState("");
  const [closeGroupOpen,   setCloseGroupOpen]   = useState(false);
  const [groupClosedBanner, setGroupClosedBanner] = useState(false);

  const [selectedExpense, setSelectedExpense] = useState<any>(null);

  const { data: GroupDetails, isLoading: groupLoading } =
    useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const { data: TodayExpenses } =
    useGetExpenseReportQuery(groupId!, { skip: !groupId });
  const { data: GroupMembers } =
    useGetGroupMembersQuery(groupId!, { skip: !groupId });
  const { data: LeftContributors } =
    useGetLeftContributorsQuery(groupId!, { skip: !groupId });
  const { data: categories = [], isLoading: catLoading } =
    useGetCategoriesQuery(groupId!, { skip: !groupId });
  const { data: meData } = useGetUserQuery();
  const currentUserId = meData?.data?.user?._id;

  // Feed the current group's balance into the tour engine so its `skipWhen`
  // predicates can short-circuit the contribution detour when the wallet is
  // already funded. Cleared on unmount so other routes don't see stale data.
  useEffect(() => {
    if (GroupDetails?.balance == null) return;
    dispatch(setTourGroupBalance(GroupDetails.balance));
    return () => {
      dispatch(setTourGroupBalance(null));
    };
  }, [dispatch, GroupDetails?.balance]);

  const {
    msg, setMsg,
    isVerifying, isInvitingMember, isChangingRole,
    isAddingContrib, isSettling, isDeletingGroup, isRemovingMember, isLeavingGroup,
    isApprovingLeave, isRejectingLeave, isCancellingOwnLeave,
    handleVerifyUser, handleInviteMember, handleChangeRole,
    handleAddContribution, handleSettlement, handleDeleteMember, handleDeleteGroup, handleLeaveGroup,
    handleApproveLeave, handleRejectLeave, handleCancelOwnLeave,
  } = useGroupDetailHandlers(groupId);

  const myMember = GroupMembers?.find((m) => m.userId._id === currentUserId);
  const hasPendingLeave = !!myMember?.leaveRequestedAt;

  const pendingLeaveCount = GroupMembers?.filter((m) => m.leaveRequestedAt).length ?? 0;

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
    // Members only see the Danger tab (leave group); admins land on Add Member.
    setTab(isAdmin ? "addMember" : "danger");
  };

  const settingsTabs: { id: SettingsTab; label: string; show: boolean }[] = [
    { id: "addMember",    label: t("groupDetail.tabAddMember"),    show: isAdmin },
    { id: "changeRole",   label: t("groupDetail.tabChangeRole"),   show: isSuperAdmin },
    { id: "contribution", label: t("groupDetail.tabContribution"), show: isAdmin },
    { id: "settlement",   label: t("groupDetail.tabSettlement"),   show: isAdmin },
    {
      id: "leaveRequests",
      label: pendingLeaveCount > 0
        ? `${t("groupDetail.tabLeaveRequests")} (${pendingLeaveCount})`
        : t("groupDetail.tabLeaveRequests"),
      show: isAdmin,
    },
    { id: "danger",       label: t("groupDetail.tabDanger"),       show: !!role },
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
          <div className="h-4 w-12 bg-white/[0.05] rounded" />
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
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
          ))}
        </main>
      </div>
    );
  }

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

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-3">

        <button
          onClick={() => navigate("/groups")}
          className="flex items-center gap-2 text-white/35 hover:text-white/60 active:text-white/60 text-xs font-medium transition-colors mb-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("groupDetail.backToGroups")}
        </button>

        {/* ── Group card ── */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1.5">
              <h1 className="text-[17px] font-semibold text-[#f0eeff] leading-tight" translate="no">
                {GroupDetails?.name}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.05] text-white/40" translate="no">
                  {GroupDetails?.displayId}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${roleGrade[role || "MEMBER"]}`}>
                  {roleLabel(role || "MEMBER")}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">{t("groupDetail.balance")}</p>
              <p className="font-mono text-[22px] font-semibold text-[#f0eeff] leading-tight" translate="no">
                ₹{GroupDetails?.balance?.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] font-mono text-white/25 mt-0.5" translate="no">
                {t("groupDetail.contributed", { amount: totalContrib.toLocaleString("en-IN") })}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-widest text-white/30">{t("groupDetail.poolRemaining")}</p>
              <p className="text-[10px] font-mono text-white/40" translate="no">{GroupDetails?.barLength}%</p>
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

        {/* ── Leave request sent banner ── */}
        {leaveRequestSent && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/25">
            <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7.5l3.5 3.5L12 3.5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-green-300 leading-tight">{t("groupDetail.leaveRequestSentTitle")}</p>
              <p className="text-[11px] text-green-400/70 mt-0.5">{t("groupDetail.leaveRequestSentDesc")}</p>
            </div>
            <button
              onClick={() => setLeaveRequestSent(false)}
              className="text-green-500/60 hover:text-green-400 active:text-green-400 transition-colors shrink-0"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Group closed banner ── */}
        {(groupClosedBanner || GroupDetails?.status === "CLOSED") && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="#fbbf24" strokeWidth="1.3" />
              <path d="M4.5 7l1.8 1.8L9.5 5.5" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-amber-300 leading-tight">
                {t("closeGroup.bannerTitle", "Group closed")}
              </p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">
                {t("closeGroup.bannerDesc", "Refunds were issued and no further changes are allowed.")}
              </p>
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className={`grid gap-2 grid-cols-3 ${isAdmin ? "sm:grid-cols-5" : ""}`}>
          {[
            {
              label: t("groupDetail.addExpense"),
              onClick: () => navigate(`/groups/${groupId}/expenses/new`),
              color: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-400/35",
              icon: <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
              tourId: "create-expense",
              // An expense needs a category — hide the entry until one exists.
              show: catLoading || categories.length > 0,
            },
            {
              label: t("groupDetail.category"),
              onClick: () => navigate(`/groups/${groupId}/categories/new`),
              color: "text-violet-300 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-400/35",
              icon: <path d="M2 4h4v4H2zM8 4h4v4H8zM2 10h4v4H2zM8 10h4v4H8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />,
              tourId: "create-category",
              show: isAdmin,
            },
            {
              label: t("groupDetail.report"),
              onClick: () => navigate(`/groups/${groupId}/activity`),
              color: "text-slate-300 bg-slate-500/10 border-slate-500/20 hover:bg-slate-500/20 hover:border-slate-400/35",
              icon: <path d="M2 12V6l4-4h6l2 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />,
              tourId: "view-report",
              show: true,
            },
            {
              label: t("groupDetail.breakdown"),
              onClick: () => navigate(`/groups/${groupId}/reports/categories`),
              color: "text-indigo-300 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-400/35",
              icon: (
                <>
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M7 1.5v5.5l4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </>
              ),
              tourId: "view-breakdown",
              show: true,
            },
            ...(role ? [{
              label: t("groupDetail.settings"),
              onClick: openSettings,
              color: "text-amber-300 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-400/35",
              show: true,
              tourId: "view-settings",
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
              data-tour={btn.tourId}
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
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] active:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <MemberAvatars members={memberNames} />
              <span className="text-xs font-medium text-white/40">
                {t("groupDetail.membersCount", { count: GroupMembers?.length ?? 0 })}
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

              <div className="px-5 py-3 border-b border-white/[0.04] bg-white/[0.015]">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-white/25">{t("groupDetail.contributions")}</p>
                  <button
                    onClick={() => navigate(`/groups/${groupId}/credits`)}
                    className="text-[10px] font-semibold text-emerald-400/70 hover:text-emerald-300 active:text-emerald-300 transition-colors flex items-center gap-1"
                  >
                    {t("groupDetail.viewAllCredits", "View all credits")}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-2">
                  {GroupMembers?.map((m) => {
                    const pct = totalContrib > 0 ? Math.round((m.contribution / totalContrib) * 100) : 0;
                    return (
                      <div key={m._id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-white/50" translate="no">{m.userId.name}</span>
                          <span className="text-[11px] font-mono text-white/40" translate="no">
                            ₹{m.contribution.toLocaleString("en-IN")}
                            <span className="text-white/20 ml-1">({pct}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-[2px] bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: "#818cf8" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(LeftContributors?.length ?? 0) > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/[0.05] space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-white/25">
                      {t("groupDetail.leftContributions", "Left member contributions")}
                    </p>
                    {LeftContributors!.map((m) => {
                      const pct = totalContrib > 0 ? Math.round((m.contribution / totalContrib) * 100) : 0;
                      return (
                        <div key={m._id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-white/40 italic flex items-center gap-1.5" translate="no">
                              {m.userId.name}
                              <span className="text-white/20 not-italic">
                                · {m.leftMode === "FORFEIT"
                                    ? t("groupDetail.forfeited", "forfeited")
                                    : t("groupDetail.left", "left")}
                              </span>
                              {m.leftMode === "FORFEIT" && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md not-italic border border-amber-500/30 bg-amber-500/10 text-amber-300">
                                  {t("groupDetail.forfeitBadge", "FORFEITED")}
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] font-mono text-white/35" translate="no">
                              ₹{m.contribution.toLocaleString("en-IN")}
                              <span className="text-white/20 ml-1">({pct}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-[2px] bg-white/[0.05] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: "#64748b" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="divide-y divide-white/[0.04]">
                {GroupMembers?.map((member) => (
                  <div key={member._id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/20
                        flex items-center justify-center text-[11px] font-bold text-cyan-400 shrink-0" translate="no">
                        {member.userId.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-white/80 leading-tight" translate="no">{member.userId.name}</p>
                        <p className="text-[11px] text-white/30 truncate" translate="no">{member.userId.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-[11px] font-mono text-white/40" translate="no">
                          ₹{member.contribution.toLocaleString("en-IN")}
                        </p>
                        {member.settlement && (
                          <p className="text-[9px] text-green-400/70 font-semibold" translate="no">
                            {t("groupDetail.settled")} · ₹{(member.settlementAmount ?? 0).toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${roleGrade[member.role]}`}>
                        {roleLabel(member.role)}
                      </span>
                      {isAdmin && member.role !== "SUPER_ADMIN" && (
                        <button
                          onClick={() => setDeleteMemberTarget({ id: member.userId._id, name: member.userId.name })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/20
                            hover:text-red-400 hover:bg-red-500/10 active:text-red-400 active:bg-red-500/10 transition-colors"
                          title={t("groupDetail.removeMemberLabel", { name: member.userId.name })}
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
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">{t("groupDetail.today")}</p>
            <div className="flex items-center gap-3">
              {(TodayExpenses?.length ?? 0) > 0 && (
                <p className="text-xs font-mono font-semibold text-white/50" translate="no">
                  ₹{todayTotal.toLocaleString("en-IN")}
                </p>
              )}
              <button
                onClick={() => navigate(`/groups/${groupId}/expenses`)}
                className="text-[10px] font-semibold text-violet-400/70 hover:text-violet-300 active:text-violet-300 transition-colors flex items-center gap-1"
              >
                {t("groupDetail.viewAll")}
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
              {t("groupDetail.noExpensesToday")}
            </div>
          ) : (
            <div className="space-y-2">
              {TodayExpenses?.map((expense, i) => (
                <div
                  key={expense._id}
                  onClick={() => setSelectedExpense(expense)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedExpense(expense);
                    }
                  }}
                  aria-label={t("groupDetail.openExpense", "Open expense: {{title}}", { title: expense.title })}
                  className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3.5
                    flex items-center justify-between cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 transition-colors"
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
                      <p className="text-[13px] font-medium text-white/80 truncate leading-tight" translate="no">
                        {expense.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{ background: expense.category.color + "20", color: expense.category.color }}
                          translate="no"
                        >
                          {expense.category.name}
                        </span>
                        <span className="text-[10px] text-white/25" translate="no">· {expense.paidBy?.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[15px] font-semibold font-mono text-[#f0eeff] leading-tight" translate="no">
                      ₹{expense?.amount?.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-white/25 mt-0.5" translate="no">{expense.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* ── Group Settings bottom sheet ── */}
      {settingsOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            <div className="w-full sm:max-w-2xl pointer-events-auto bg-[#0d1220]
              border border-white/[0.08] sm:border-b sm:rounded-2xl
              rounded-t-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col
              pb-safe
              shadow-[0_-8px_40px_rgba(0,0,0,0.5)]">

              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-white/10" />
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <p className="text-sm font-semibold text-white/70">{t("groupDetail.groupSettings")}</p>
                <button
                  onClick={() => setSettingsOpen(false)}
                  data-tour="settings-close"
                  className="w-7 h-7 flex items-center justify-center rounded-lg
                    bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08] active:text-white/70 active:bg-white/[0.08] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="relative border-b border-white/[0.06] shrink-0">
                <div className="flex overflow-x-auto no-scrollbar px-4 pt-2 gap-1">
                  {settingsTabs.filter((t) => t.show).map((tabItem) => (
                    <button
                      key={tabItem.id}
                      onClick={() => switchTab(tabItem.id)}
                      data-tour={`settings-${tabItem.id}`}
                      className={`px-3.5 pb-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2
                        ${tab === tabItem.id
                          ? tabItem.id === "danger"
                            ? "text-red-400 border-red-500"
                            : "text-cyan-300 border-cyan-400"
                          : "text-white/35 border-transparent hover:text-white/55 active:text-white/55"
                        }`}
                    >
                      {tabItem.label}
                    </button>
                  ))}
                </div>
                <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-[#0d1220] to-transparent sm:hidden" />
              </div>

              <div className="px-5 py-4 space-y-3 flex-1">

                <StatusBanner status={msg ? (msg.ok ? "ok" : "err") : null} text={msg?.text ?? ""} />

                {tab === "addMember" && (
                  <SettingsAddMember
                    isVerifying={isVerifying}
                    isInvitingMember={isInvitingMember}
                    handleVerifyUser={handleVerifyUser}
                    handleInviteMember={handleInviteMember}
                  />
                )}

                {tab === "changeRole" && (
                  <SettingsChangeRole
                    members={GroupMembers}
                    isChangingRole={isChangingRole}
                    handleChangeRole={handleChangeRole}
                  />
                )}

                {tab === "contribution" && (
                  <SettingsContribution
                    members={GroupMembers}
                    isAddingContrib={isAddingContrib}
                    handleAddContribution={handleAddContribution}
                  />
                )}

                {tab === "settlement" && (
                  <SettingsSettlement
                    members={GroupMembers}
                    isSettling={isSettling}
                    handleSettlement={handleSettlement}
                  />
                )}

                {tab === "leaveRequests" && (
                  <SettingsLeaveRequests
                    members={GroupMembers}
                    isSuperAdmin={isSuperAdmin}
                    isApprovingLeave={isApprovingLeave}
                    isRejectingLeave={isRejectingLeave}
                    handleApproveLeave={handleApproveLeave}
                    handleRejectLeave={handleRejectLeave}
                  />
                )}

                {tab === "danger" && (
                  <SettingsDangerZone
                    isSuperAdmin={isSuperAdmin}
                    onRequestDeleteGroup={() => { setSettingsOpen(false); setDeleteGroupOpen(true); }}
                    onRequestLeaveGroup={() => { setSettingsOpen(false); setLeaveGroupOpen(true); }}
                    onRequestForfeitLeave={() => { setSettingsOpen(false); setForfeitLeaveOpen(true); }}
                    onRequestCloseGroup={
                      isSuperAdmin && GroupDetails?.status !== "CLOSED"
                        ? () => { setSettingsOpen(false); setCloseGroupOpen(true); }
                        : undefined
                    }
                    hasPendingLeave={hasPendingLeave}
                    onCancelOwnLeave={handleCancelOwnLeave}
                    isCancellingOwnLeave={isCancellingOwnLeave}
                  />
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
        label={t("groupDetail.removeMemberLabel", { name: deleteMemberTarget?.name ?? "" })}
        confirmText="REMOVE"
        isLoading={isRemovingMember}
        error={deleteMemberError}
      >
        <p className="text-sm text-white/50">
          {t("deleteModal.destructiveAction")} —{" "}
          <span className="text-white/80 font-medium" translate="no">{deleteMemberTarget?.name}</span>.{" "}
          {t("groupDetail.removeMemberConfirm")}
        </p>
      </DeleteConfirmModal>

      {/* ── Delete Group modal ── */}
      <DeleteConfirmModal
        isOpen={deleteGroupOpen}
        onClose={() => { setDeleteGroupOpen(false); setDeleteGroupError(""); }}
        onConfirm={() => handleDeleteGroup(setDeleteGroupError)}
        label={t("groupDetail.deleteGroup")}
        confirmText="DELETE"
        isLoading={isDeletingGroup}
        error={deleteGroupError}
      >
        <p className="text-sm text-white/50">
          <span className="text-white/80 font-medium" translate="no">{GroupDetails?.name}</span> —{" "}
          {t("groupDetail.deleteGroupConfirm")}
        </p>
      </DeleteConfirmModal>

      {/* ── Leave Group modal ── */}
      <DeleteConfirmModal
        isOpen={leaveGroupOpen}
        onClose={() => { setLeaveGroupOpen(false); setLeaveGroupError(""); }}
        onConfirm={async () => {
          const result = await handleLeaveGroup(setLeaveGroupError);
          if (result === "requested") {
            setLeaveGroupOpen(false);
            setLeaveGroupError("");
            setLeaveRequestSent(true);
          }
        }}
        label={t("groupDetail.leaveGroup", "Leave Group")}
        confirmText="LEAVE"
        isLoading={isLeavingGroup}
        error={leaveGroupError}
      >
        <p className="text-sm text-white/50">
          <span className="text-white/80 font-medium" translate="no">{GroupDetails?.name}</span> —{" "}
          {t(
            "groupDetail.leaveGroupConfirm",
            "You will lose access to this group's expenses and activity. This cannot be undone by you."
          )}
        </p>
      </DeleteConfirmModal>

      {/* ── Leave Without Settlement (forfeit) modal ── */}
      <DeleteConfirmModal
        isOpen={forfeitLeaveOpen}
        onClose={() => { setForfeitLeaveOpen(false); setForfeitLeaveError(""); }}
        onConfirm={() => handleLeaveGroup(setForfeitLeaveError, "forfeit")}
        label={t("groupDetail.leaveWithoutSettlement", "Leave without settlement")}
        confirmText="FORFEIT"
        isLoading={isLeavingGroup}
        error={forfeitLeaveError}
      >
        <p className="text-sm text-white/50">
          <span className="text-white/80 font-medium" translate="no">{GroupDetails?.name}</span> —{" "}
          {t(
            "groupDetail.leaveWithoutSettlementConfirm",
            "Your contribution stays in the group pool and will not be refunded. You leave instantly without admin approval. This cannot be undone."
          )}
        </p>
      </DeleteConfirmModal>

      {/* ── Close Group modal ── */}
      {groupId && (
        <CloseGroupModal
          isOpen={closeGroupOpen}
          groupId={groupId}
          onClose={() => setCloseGroupOpen(false)}
          onClosed={() => {
            setCloseGroupOpen(false);
            setGroupClosedBanner(true);
          }}
        />
      )}

      {/* ── Expense detail modal ── */}
      <ExpenseDetailModal expense={selectedExpense} onClose={() => setSelectedExpense(null)} role={role} groupId={groupId} group={GroupDetails} />

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
