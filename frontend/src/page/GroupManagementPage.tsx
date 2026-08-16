import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DeleteConfirmModal from "../components/deleteModel";
import NotFoundPage from "./NotFoundPage";
import CloseGroupModal from "../components/CloseGroupModal";
import CloneGroupModal from "../components/CloneGroupModal";
import {
  useGetGroupMembersQuery,
  useGetGroupByIdQuery,
  useInviteMemberMutation,
} from "../redux/api/group";
import {
  useGetPendingJoinRequestsQuery,
  useApproveJoinMutation,
  useDeclineJoinMutation,
} from "../redux/api/invite";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useGroupDetailHandlers } from "../handlers/useGroupDetailHandlers";
import type { SettingsTab, Group } from "../interface/group";
import {
  ActionButton,
  BackButton,
  PageBackground,
  PageContainer,
  PageHeader,
  StatusBanner,
  UpgradeNote,
} from "../components/ui";
import { useGroupPlan } from "../hooks/usePlan";
import {
  ManagementTabs,
  tabId,
  tabPanelId,
  SettingsAddMember,
  SettingsJoinLink,
  SettingsChangeRole,
  SettingsContribution,
  SettingsSettlement,
  SettingsJoinRequests,
  SettingsLeaveRequests,
  SettingsDangerZone,
  type ManagementTabDef,
} from "../components/groupSettings";
import type { DeclineJoinArgs } from "../components/groupSettings/SettingsJoinRequests";

/**
 * Group Management — the screen that used to be a modal over the group overview.
 *
 * Its state lives in the URL: `/groups/:groupId/manage?tab=<tab>`. That was
 * already true of the old sheet's deep link (`?settings=<tab>`), and as a route
 * it also survives the back button, which a dialog opened over another screen
 * never did.
 *
 * The destructive flows (delete, leave, forfeit, close, clone) still confirm in
 * a modal — they are one-shot confirmations, not places you navigate to — but
 * they no longer have to dismiss a panel first, because the panel is the page.
 */
export default function GroupManagementPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const [deleteGroupError, setDeleteGroupError] = useState("");
  const [leaveGroupOpen, setLeaveGroupOpen] = useState(false);
  const [leaveGroupError, setLeaveGroupError] = useState("");
  const [forfeitLeaveOpen, setForfeitLeaveOpen] = useState(false);
  const [forfeitLeaveError, setForfeitLeaveError] = useState("");
  const [closeGroupOpen, setCloseGroupOpen] = useState(false);
  const [cloneGroupOpen, setCloneGroupOpen] = useState(false);
  const [joinReviewError, setJoinReviewError] = useState("");

  const { data: GroupDetails, isLoading: groupLoading, isError: groupError } =
    useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const { data: GroupMembers } =
    useGetGroupMembersQuery(groupId!, { skip: !groupId });
  const { userId: currentUserId } = useCurrentUser();

  const {
    msg, setMsg,
    isVerifying, isInvitingMember, isChangingRole,
    isAddingContrib, isSettling, isDeletingGroup, isLeavingGroup,
    isApprovingLeave, isRejectingLeave, isCancellingOwnLeave,
    handleVerifyUser, handleInviteMember, handleChangeRole,
    handleAddContribution, handleSettlement, handleDeleteGroup, handleLeaveGroup,
    handleApproveLeave, handleRejectLeave, handleCancelOwnLeave,
  } = useGroupDetailHandlers(groupId);

  const myMember = GroupMembers?.find((m) => m.userId._id === currentUserId);
  const hasPendingLeave = !!myMember?.leaveRequestedAt;
  const pendingLeaveCount = GroupMembers?.filter((m) => m.leaveRequestedAt).length ?? 0;

  const role = GroupDetails?.role as Group["role"];
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isSuperAdmin = role === "SUPER_ADMIN";

  // Member headroom on THIS group's plan. The backend rejects the invite at the
  // cap (402), so warning here is the difference between "the form explained
  // why" and "the form failed". `null` means unlimited — never warn on Premium.
  const { limits: planLimits, tier: planTier } = useGroupPlan(groupId);
  const memberCap = planLimits.maxMembersPerGroup;
  const memberCount = GroupMembers?.length ?? 0;
  const memberSeatsLeft = memberCap === null ? null : Math.max(0, memberCap - memberCount);
  const isClosed = GroupDetails?.status === "CLOSED";

  // Join approvals are admin-only; skip the fetch entirely for plain members.
  const { data: joinRequests } = useGetPendingJoinRequestsQuery(groupId!, {
    skip: !groupId || !isAdmin,
  });
  const [approveJoin, { isLoading: isApprovingJoin }] = useApproveJoinMutation();
  const [declineJoin, { isLoading: isDecliningJoin }] = useDeclineJoinMutation();
  // Used only for the "decline, then re-invite" path in the requests queue.
  const [inviteMember, { isLoading: isReinviting }] = useInviteMemberMutation();

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

  /**
   * The active tab is read from `?tab=`, never mirrored into state — deriving it
   * keeps the URL truthful, so the view stays shareable and survives a refresh.
   *
   * A member deep-linking to an admin tab falls back to what their role can see,
   * so the URL can never open a panel the role isn't allowed to act on.
   */
  const allowedTabs: SettingsTab[] = isSuperAdmin
    ? ["addMember", "changeRole", "contribution", "settlement", "requests", "danger"]
    : isAdmin
      ? ["addMember", "contribution", "settlement", "requests", "danger"]
      : ["danger"];

  const tabParam = searchParams.get("tab") as SettingsTab | null;
  const activeTab: SettingsTab =
    tabParam && allowedTabs.includes(tabParam) ? tabParam : allowedTabs[0];

  // `replace` so tabbing across the rail does not stack history entries between
  // the group overview and wherever the user goes next.
  const switchTab = (next: SettingsTab) => {
    setMsg(null);
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const tabs: ManagementTabDef[] = [
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

  // The rail can't be drawn before the role is known — which tabs exist depends
  // on it — so the placeholder stands in for the header, the rail and one panel.
  if (groupLoading) {
    return (
      <div className="min-h-screen bg-surface text-fg">
        <PageBackground />
        <PageContainer width="content" className="animate-pulse">
          <div className="h-4 w-24 bg-surface-hover rounded" />
          <div className="space-y-2 pt-2">
            <div className="h-3 w-20 bg-surface-hover rounded" />
            <div className="h-6 w-56 bg-line rounded" />
            <div className="h-3 w-64 bg-surface-hover rounded" />
          </div>
          <div className="flex gap-3 border-b border-line pb-2 pt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-3 w-20 bg-surface-hover rounded" />
            ))}
          </div>
          <div className="h-40 rounded-xl bg-surface-raised border border-line" />
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />

      <PageContainer width="content">
        <div className="inline-block">
          <BackButton
            label={t("groupManagement.backToGroup", "Back to group")}
            onClick={() => navigate(`/groups/${groupId}`)}
          />
        </div>

        <PageHeader
          accent="brand"
          icon={
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M7 1.4v1.4M7 11.2v1.4M12.6 7h-1.4M2.8 7H1.4M10.96 3.04l-1 1M4.04 9.96l-1 1M10.96 10.96l-1-1M4.04 4.04l-1-1"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          }
          label={t("groupManagement.label", "Manage")}
          title={t("groupManagement.title", "Group Management")}
          description={
            GroupDetails?.name
              ? t("groupManagement.descriptionFor", {
                  group: GroupDetails.name,
                  defaultValue: "Members, contributions and requests for {{group}}.",
                })
              : t(
                  "groupManagement.description",
                  "Members, contributions, settlements and requests for this group."
                )
          }
        />

        <ManagementTabs
          tabs={tabs}
          activeTab={activeTab}
          onSwitchTab={switchTab}
          ariaLabel={t("groupManagement.title", "Group Management")}
        />

        <div
          role="tabpanel"
          id={tabPanelId(activeTab)}
          aria-labelledby={tabId(activeTab)}
          className="space-y-4 max-w-3xl"
        >
          <StatusBanner status={msg ? (msg.ok ? "ok" : "err") : null} text={msg?.text ?? ""} />

          {activeTab === "addMember" && (
            <div className="space-y-6">
              {/* Two states, because they need different words: at the cap the
                  invite will be refused outright, while one seat left is worth
                  knowing before you go looking for a second person. */}
              <UpgradeNote
                show={!isClosed && memberSeatsLeft !== null && memberSeatsLeft <= 1}
                groupId={groupId}
                canUpgrade={isAdmin}
                variant={memberSeatsLeft === 0 ? "blocked" : "hint"}
              >
                {memberSeatsLeft === 0
                  ? t("upgrade.membersFull", {
                      defaultValue:
                        "This group is full — the {{tier}} plan allows {{cap}} members. New invites will be refused until its plan is raised.",
                      tier: planTier,
                      cap: memberCap,
                    })
                  : t("upgrade.membersNearlyFull", {
                      defaultValue:
                        "1 seat left of the {{cap}} the {{tier}} plan allows.",
                      tier: planTier,
                      cap: memberCap,
                    })}
              </UpgradeNote>

              <SettingsAddMember
                isVerifying={isVerifying}
                isInvitingMember={isInvitingMember}
                handleVerifyUser={handleVerifyUser}
                handleInviteMember={handleInviteMember}
              />
              {/* Same tab because it's the same job — adding people. Inviting by
                  email targets one known account; the link reaches whoever it's
                  shared with. Both queue for approval. */}
              <div className="pt-4 border-t border-line">
                <SettingsJoinLink groupId={groupId} />
              </div>
            </div>
          )}

          {activeTab === "changeRole" && (
            <SettingsChangeRole
              members={GroupMembers}
              isChangingRole={isChangingRole}
              handleChangeRole={handleChangeRole}
            />
          )}

          {activeTab === "contribution" && (
            <SettingsContribution
              groupId={groupId}
              members={GroupMembers}
              isAddingContrib={isAddingContrib}
              handleAddContribution={handleAddContribution}
            />
          )}

          {activeTab === "settlement" && (
            <SettingsSettlement
              members={GroupMembers}
              isSettling={isSettling}
              handleSettlement={handleSettlement}
            />
          )}

          {activeTab === "requests" && (
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

          {activeTab === "danger" && (
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
                  <ActionButton tone="brand" onClick={() => setCloneGroupOpen(true)}>
                    {t("cloneGroup.confirm", "Clone group")}
                  </ActionButton>
                </div>
              )}
              <SettingsDangerZone
                isSuperAdmin={isSuperAdmin}
                onRequestDeleteGroup={() => setDeleteGroupOpen(true)}
                onRequestLeaveGroup={() => setLeaveGroupOpen(true)}
                onRequestForfeitLeave={() => setForfeitLeaveOpen(true)}
                onRequestCloseGroup={
                  isSuperAdmin && GroupDetails?.status !== "CLOSED"
                    ? () => setCloseGroupOpen(true)
                    : undefined
                }
                hasPendingLeave={hasPendingLeave}
                onCancelOwnLeave={handleCancelOwnLeave}
                isCancellingOwnLeave={isCancellingOwnLeave}
              />
            </div>
          )}
        </div>
      </PageContainer>

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
            // The overview owns the "request sent" banner, so hand the user
            // back to it rather than announcing it twice.
            navigate(`/groups/${groupId}?leaveRequested=1`);
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
            navigate(`/groups/${groupId}`);
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
          onClose={() => setCloneGroupOpen(false)}
        />
      )}
    </div>
  );
}
