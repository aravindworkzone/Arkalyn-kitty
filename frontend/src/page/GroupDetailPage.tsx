import { useState, useEffect } from "react";
import { Navigate, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import DeleteConfirmModal from "../components/deleteModel";
import NotFoundPage from "./NotFoundPage";
import ExpenseDetailModal from "../components/ExpenseDetailModal";
import { useGetExpenseReportQuery } from "../redux/api/expense";
import {
  useGetGroupMembersQuery,
  useGetGroupByIdQuery,
  useGetLeftContributorsQuery,
} from "../redux/api/group";
import { useGetGroupLinksQuery } from "../redux/api/groupLink";
import { useGroupDetailHandlers } from "../handlers/useGroupDetailHandlers";
import { PageBackground, PageContainer } from "../components/ui";
import GroupSummaryCard from "../components/groupDetail/GroupSummaryCard";
import GroupBanners from "../components/groupDetail/GroupBanners";
import QuickAccessButton from "../components/groupDetail/QuickAccessButton";
import type { AppLayoutContext } from "../components/AppLayout";
import GroupMembersPanel from "../components/groupDetail/GroupMembersPanel";
import TodayExpenseFeed from "../components/groupDetail/TodayExpenseFeed";
import GroupDetailSkeleton from "../components/groupDetail/GroupDetailSkeleton";
import { useTranslation } from "react-i18next";
import { joinGroup } from "../socket/emiter/group.emit";
import { setGroupId } from "../redux/slice/group.slice";
import { useDispatch } from "react-redux";
import { type Group } from "../interface/group";

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { openSidebar, canOpenSidebar } = useOutletContext<AppLayoutContext>();
  const { t } = useTranslation();
  const dispatch = useDispatch();

  useEffect(() => {

    if (!groupId) return;
    dispatch(setGroupId(groupId));

    joinGroup(groupId);

  }, [groupId]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [deleteMemberTarget, setDeleteMemberTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteMemberError,  setDeleteMemberError]  = useState("");

  const [selectedExpense, setSelectedExpense] = useState<any>(null);

  const { data: GroupDetails, isLoading: groupLoading, isError: groupError } =
    useGetGroupByIdQuery(groupId!, { skip: !groupId });
  const { data: TodayExpenses } =
    useGetExpenseReportQuery(groupId!, { skip: !groupId });
  const { data: GroupMembers } =
    useGetGroupMembersQuery(groupId!, { skip: !groupId });
  const { data: LeftContributors } =
    useGetLeftContributorsQuery(groupId!, { skip: !groupId });
  // Reading links is ungated by plan and open to every member, so the roster
  // can list funding groups alongside the people who paid in.
  const { data: GroupLinks } =
    useGetGroupLinksQuery(groupId!, { skip: !groupId });

  const { isRemovingMember, handleDeleteMember } = useGroupDetailHandlers(groupId);

  const memberNames   = GroupMembers?.map((m) => m.userId.name) ?? [];
  const totalContrib  = GroupDetails?.totalContribution ?? 0;

  const role = GroupDetails?.role as Group["role"];
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  /**
   * Group Management used to be a dialog over this screen, opened by
   * `?settings=<tab>`. It is page/GroupManagementPage.tsx now, so any link still
   * carrying that param — a bookmark, a stale notification — is forwarded rather
   * than silently dropping the user on the overview.
   */
  const settingsParam = searchParams.get("settings");
  if (settingsParam) {
    return <Navigate to={`/groups/${groupId}/manage?tab=${settingsParam}`} replace />;
  }

  // Set by the leave flow on the management page, which navigates back here so
  // the notice lands on the screen the user stays on.
  const leaveRequestSent = searchParams.get("leaveRequested") === "1";

  const dismissLeaveRequest = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("leaveRequested");
    setSearchParams(next, { replace: true });
  };

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


      <PageContainer width="content">

        <button
          onClick={() => navigate("/groups")}
          className="flex items-center gap-2 text-fg-muted hover:text-fg active:text-fg text-theme-xs font-medium transition-colors
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
          onDismissLeaveRequest={dismissLeaveRequest}
          groupClosed={GroupDetails?.status === "CLOSED"}
        />

        <QuickAccessButton onOpenSidebar={openSidebar} show={canOpenSidebar} />

        {/* Roster and today's feed sit side by side once there is room for two
            columns. They answer different questions — who is in this group, and
            what happened today — so neither has to be scrolled past to reach
            the other. */}
        <div className="grid gap-6 lg:gap-8 items-start lg:grid-cols-2">
          <GroupMembersPanel
            members={GroupMembers}
            leftContributors={LeftContributors}
            fundingLinks={GroupLinks?.incoming}
            memberNames={memberNames}
            totalContribution={totalContrib}
            groupName={GroupDetails?.name}
            isAdmin={isAdmin}
            onViewCredits={() => navigate(`/groups/${groupId}/credits`)}
            onViewConnections={() => navigate(`/groups/${groupId}/connections`)}
            onRemoveMember={setDeleteMemberTarget}
          />

          <TodayExpenseFeed
            expenses={TodayExpenses}
            onSelect={setSelectedExpense}
            onViewAll={() => navigate(`/groups/${groupId}/expenses`)}
          />
        </div>

      </PageContainer>

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

      {/* ── Expense detail modal ── */}
      <ExpenseDetailModal expense={selectedExpense} onClose={() => setSelectedExpense(null)} role={role} groupId={groupId} group={GroupDetails} />
    </div>
  );
}
