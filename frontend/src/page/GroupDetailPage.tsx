import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/header";
import DeleteConfirmModal from "../components/deleteModel";
import NotFoundPage from "./NotFoundPage";
import CloseGroupModal from "../components/CloseGroupModal";
import CloneGroupModal from "../components/CloneGroupModal";
import ExpenseDetailModal from "../components/ExpenseDetailModal";
import { useGetExpenseReportQuery } from "../redux/api/expense";
import { useGetCategoriesQuery } from "../redux/api/category";
import {
  useGetGroupMembersQuery,
  useGetGroupByIdQuery,
  useGetLeftContributorsQuery,
  useInviteMemberMutation,
} from "../redux/api/group";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useGroupDetailHandlers } from "../handlers/useGroupDetailHandlers";
import type { SettingsTab } from "../interface/group";
import { ActionButton, PageBackground } from "../components/ui";
import GroupSummaryCard from "../components/groupDetail/GroupSummaryCard";
import GroupBanners from "../components/groupDetail/GroupBanners";
import GroupActionBar from "../components/groupDetail/GroupActionBar";
import GroupMembersPanel from "../components/groupDetail/GroupMembersPanel";
import TodayExpenseFeed from "../components/groupDetail/TodayExpenseFeed";
import GroupSettingsSheet from "../components/groupDetail/GroupSettingsSheet";
import GroupDetailSkeleton from "../components/groupDetail/GroupDetailSkeleton";
import {
  SettingsAddMember,
  SettingsChangeRole,
  SettingsContribution,
  SettingsSettlement,
  SettingsJoinRequests,
  SettingsLeaveRequests,
  SettingsDangerZone,
} from "../components/groupSettings";
import type { DeclineJoinArgs } from "../components/groupSettings/SettingsJoinRequests";
import {
  useGetPendingJoinRequestsQuery,
  useApproveJoinMutation,
  useDeclineJoinMutation,
} from "../redux/api/invite";
import { useTranslation } from "react-i18next";
import { joinGroup } from "../socket/emiter/group.emit";
import { setGroupId } from "../redux/slice/group.slice";
import { useDispatch } from "react-redux";
import { type Group } from "../interface/group";

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
  const [cloneGroupOpen,   setCloneGroupOpen]   = useState(false);
  const [groupClosedBanner, setGroupClosedBanner] = useState(false);

  const [selectedExpense, setSelectedExpense] = useState<any>(null);

  // Freeze background scroll while the settings modal is open.
  useEffect(() => {
    if (!settingsOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [settingsOpen]);

  const { data: GroupDetails, isLoading: groupLoading, isError: groupError } =
    useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const { data: TodayExpenses } =
    useGetExpenseReportQuery(groupId!, { skip: !groupId });
  const { data: GroupMembers } =
    useGetGroupMembersQuery(groupId!, { skip: !groupId });
  const { data: LeftContributors } =
    useGetLeftContributorsQuery(groupId!, { skip: !groupId });
  const { data: categories = [], isLoading: catLoading } =
    useGetCategoriesQuery(groupId!, { skip: !groupId });
  const { userId: currentUserId } = useCurrentUser();

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

  // Join approvals are admin-only; skip the fetch entirely for plain members.
  const canReviewJoins = GroupDetails?.role === "SUPER_ADMIN" || GroupDetails?.role === "ADMIN";
  const { data: joinRequests } = useGetPendingJoinRequestsQuery(groupId!, {
    skip: !groupId || !canReviewJoins,
  });
  const [approveJoin, { isLoading: isApprovingJoin }] = useApproveJoinMutation();
  const [declineJoin, { isLoading: isDecliningJoin }] = useDeclineJoinMutation();
  // Used only for the "decline, then re-invite" path in the requests queue.
  const [inviteMember, { isLoading: isReinviting }] = useInviteMemberMutation();
  const [joinReviewError, setJoinReviewError] = useState("");

  const pendingJoinCount = joinRequests?.length ?? 0;
  // The tab badge counts both queues it now holds.
  const pendingRequestCount = pendingLeaveCount + pendingJoinCount;

  const handleApproveJoin = async (inviteId: string) => {
    setJoinReviewError("");
    try {
      await approveJoin({ groupId: groupId!, inviteId }).unwrap();
    } catch (err: any) {
      setJoinReviewError(err?.data?.message || t("joinRequests.actionFailed"));
    }
  };

  const handleDeclineJoin = async ({ inviteId, invitedUserId, reinvite }: DeclineJoinArgs) => {
    setJoinReviewError("");
    try {
      await declineJoin({ groupId: groupId!, inviteId }).unwrap();
    } catch (err: any) {
      setJoinReviewError(err?.data?.message || t("joinRequests.actionFailed"));
      return;
    }

    if (!reinvite) return;
    // Order matters: the server refuses a second invite while one is still
    // PENDING/PENDING_APPROVAL, so this only works once the decline has landed.
    // The decline is already committed, so a failure here costs only the
    // re-invite — hence its own message rather than the generic one.
    try {
      await inviteMember({ groupId: groupId!, invitedUser: invitedUserId }).unwrap();
    } catch (err: any) {
      setJoinReviewError(
        err?.data?.error || err?.data?.message || t("joinRequests.reinviteFailed")
      );
    }
  };

  const memberNames   = GroupMembers?.map((m) => m.userId.name) ?? [];
  const totalContrib  = GroupDetails?.totalContribution ?? 0;

  const role        = GroupDetails?.role as Group["role"];
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
      id: "requests",
      label: pendingRequestCount > 0
        ? `${t("groupDetail.tabRequests")} (${pendingRequestCount})`
        : t("groupDetail.tabRequests"),
      show: isAdmin,
    },
    { id: "danger",       label: t("groupDetail.tabDanger"),       show: !!role },
  ];

  // Non-members (403) and unknown groups (404) both land here.
  if (groupError) {
    return <NotFoundPage />;
  }

  if (groupLoading) {
    return <GroupDetailSkeleton />;
  }

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />

      <Header />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-3">

        <button
          onClick={() => navigate("/groups")}
          className="flex items-center gap-2 text-fg-muted hover:text-fg active:text-fg text-theme-xs font-medium transition-colors mb-2
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("groupDetail.backToGroups")}
        </button>

        <GroupSummaryCard
          group={GroupDetails}
          role={role}
          memberNames={memberNames}
          totalContribution={totalContrib}
        />

        <GroupBanners
          leaveRequestSent={leaveRequestSent}
          onDismissLeaveRequest={() => setLeaveRequestSent(false)}
          groupClosed={groupClosedBanner || GroupDetails?.status === "CLOSED"}
        />

        <GroupActionBar
          groupId={groupId}
          isAdmin={isAdmin}
          hasRole={!!role}
          showAddExpense={catLoading || categories.length > 0}
          navigate={navigate}
          onOpenSettings={openSettings}
        />

        <GroupMembersPanel
          members={GroupMembers}
          leftContributors={LeftContributors}
          memberNames={memberNames}
          totalContribution={totalContrib}
          groupName={GroupDetails?.name}
          isAdmin={isAdmin}
          onViewCredits={() => navigate(`/groups/${groupId}/credits`)}
          onRemoveMember={setDeleteMemberTarget}
        />

        <TodayExpenseFeed
          expenses={TodayExpenses}
          onSelect={setSelectedExpense}
          onViewAll={() => navigate(`/groups/${groupId}/expenses`)}
        />

      </main>

      <GroupSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        tabs={settingsTabs}
        activeTab={tab}
        onSwitchTab={switchTab}
        message={msg}
      >
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
            groupId={groupId}
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

        {tab === "requests" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-theme-2xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
                {t("joinRequests.heading")}
                {pendingJoinCount > 0 ? ` (${pendingJoinCount})` : ""}
              </p>
              <SettingsJoinRequests
                requests={joinRequests}
                onApprove={handleApproveJoin}
                onDecline={handleDeclineJoin}
                isApproving={isApprovingJoin}
                // The re-invite runs inside the decline action, so it
                // keeps the same button spinning.
                isDeclining={isDecliningJoin || isReinviting}
                error={joinReviewError}
              />
            </div>

            <div className="space-y-2">
              <p className="text-theme-2xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
                {t("leaveRequests.heading")}
                {pendingLeaveCount > 0 ? ` (${pendingLeaveCount})` : ""}
              </p>
              <SettingsLeaveRequests
                members={GroupMembers}
                isSuperAdmin={isSuperAdmin}
                isApprovingLeave={isApprovingLeave}
                isRejectingLeave={isRejectingLeave}
                handleApproveLeave={handleApproveLeave}
                handleRejectLeave={handleRejectLeave}
              />
            </div>
          </div>
        )}

        {tab === "danger" && (
          <div className="space-y-3">
            {/* Cloning stays available on closed groups — it copies the
                frozen structure into a fresh active group. The modal gates
                allow/block on the group's frozen plan. */}
            {isSuperAdmin && (
              <div className="bg-brand-50 border border-brand-200 dark:bg-brand-500/[0.06] dark:border-brand-500/15 rounded-xl px-4 py-4">
                <p className="text-theme-xs font-semibold text-brand-700 dark:text-brand-300 mb-1">
                  {t("cloneGroup.title", "Clone this group")}
                </p>
                <p className="text-theme-xs text-fg-muted mb-3">
                  {t(
                    "cloneGroup.settingsDesc",
                    "Create a new group with the same categories and re-invite the current members. The balance starts empty — no expenses or contributions are copied."
                  )}
                </p>
                <ActionButton
                  tone="brand"
                  onClick={() => { setSettingsOpen(false); setCloneGroupOpen(true); }}
                >
                  {t("cloneGroup.confirm", "Clone group")}
                </ActionButton>
              </div>
            )}
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
          </div>
        )}
      </GroupSettingsSheet>

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
        <p className="text-theme-sm text-fg-muted">
          {t("deleteModal.destructiveAction")} —{" "}
          <span className="text-fg font-medium" translate="no">{deleteMemberTarget?.name}</span>.{" "}
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
        <p className="text-theme-sm text-fg-muted">
          <span className="text-fg font-medium" translate="no">{GroupDetails?.name}</span> —{" "}
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
        <p className="text-theme-sm text-fg-muted">
          <span className="text-fg font-medium" translate="no">{GroupDetails?.name}</span> —{" "}
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
        <p className="text-theme-sm text-fg-muted">
          <span className="text-fg font-medium" translate="no">{GroupDetails?.name}</span> —{" "}
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

      {/* ── Clone Group modal ── */}
      {groupId && (
        <CloneGroupModal
          isOpen={cloneGroupOpen}
          sourceGroupId={groupId}
          sourceName={GroupDetails?.name ?? ""}
          sourceStatus={GroupDetails?.status}
          sourcePlanTier={GroupDetails?.planSnapshot?.tier}
          onClose={() => setCloneGroupOpen(false)}
        />
      )}

      {/* ── Expense detail modal ── */}
      <ExpenseDetailModal expense={selectedExpense} onClose={() => setSelectedExpense(null)} role={role} groupId={groupId} group={GroupDetails} />
    </div>
  );
}
