import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePreviewJoinLinkQuery, useJoinViaLinkMutation } from "../redux/api/joinLink";
import {
  AmountInput,
  Button,
  Card,
  Label,
  PageBackground,
  PageContainer,
  PageHeader,
} from "../components/ui";

/**
 * The landing page for a shared join link: /join/:token
 *
 * Sits behind ProtectedRouter, so a signed-out visitor is bounced to /login and
 * returned here afterwards (see redirectTarget in handlers/useAuthHandlers.ts).
 * Requiring an account first is what lets the request carry a real identity into
 * the admin queue.
 *
 * Clicking the link does not join anything. It files a request that an admin has
 * to approve — the same queue an emailed invite lands in — and the copy says so
 * before and after submitting.
 */
export default function JoinGroupPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [contribution, setContribution] = useState("");
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState("");

  const {
    data: preview,
    isLoading,
    error: previewError,
  } = usePreviewJoinLinkQuery(token!, { skip: !token });
  const [joinViaLink, { isLoading: isJoining }] = useJoinViaLinkMutation();

  const onJoin = async () => {
    setApiError("");
    try {
      await joinViaLink({ token: token!, contribution: Number(contribution) || 0 }).unwrap();
      setSent(true);
    } catch (err: any) {
      setApiError(err?.data?.message || t("joinLink.failed", "Couldn't send your request."));
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />
      <PageContainer width="form">
        <PageHeader
          accent="brand"
          icon={
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M5.6 8.4 8.4 5.6M4.9 3.5l.7-.7a2.47 2.47 0 0 1 3.5 3.5l-.7.7M9.1 10.5l-.7.7a2.47 2.47 0 0 1-3.5-3.5l.7-.7"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          }
          label={t("joinLink.label", "Invitation")}
          title={t("joinLink.title", "Join a group")}
          description={t(
            "joinLink.description",
            "Someone shared this group with you. Sending a request doesn't join you yet — an admin has to approve it first."
          )}
        />
        {children}
      </PageContainer>
    </div>
  );

  if (isLoading) {
    return shell(
      <Card>
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-48 bg-line rounded" />
          <div className="h-3 w-32 bg-surface-hover rounded" />
          <div className="h-11 w-full bg-surface-hover rounded-xl" />
        </div>
      </Card>
    );
  }

  // A revoked, expired or invented token all land here and read the same, which
  // is what stops the token space being probed for which groups exist.
  if (previewError || !preview) {
    return shell(
      <Card>
        <p className="text-theme-sm text-fg">
          {(previewError as any)?.data?.message ??
            t("joinLink.invalid", "This join link is no longer valid.")}
        </p>
        <Button className="mt-4" onClick={() => navigate("/groups")}>
          {t("joinLink.goToGroups", "Go to my groups")}
        </Button>
      </Card>
    );
  }

  const { group, memberCount, alreadyMember, pendingStatus } = preview;

  const GroupIdentity = (
    <div className="space-y-1">
      <p className="text-theme-lg font-semibold text-fg" translate="no">
        {group.name}
      </p>
      <p className="text-theme-xs text-fg-muted" translate="no">
        {group.displayId} ·{" "}
        {t("joinLink.members", "{{people}} members", { people: memberCount })}
      </p>
    </div>
  );

  if (sent || pendingStatus === "PENDING_APPROVAL") {
    return shell(
      <Card>
        <div className="space-y-4">
          {GroupIdentity}
          <p className="text-theme-sm text-success-700 dark:text-success-400">
            {t(
              "joinLink.waiting",
              "Your request is with the group's admins. You'll be notified once someone approves it."
            )}
          </p>
          <Button variant="secondary" onClick={() => navigate("/groups")}>
            {t("joinLink.goToGroups", "Go to my groups")}
          </Button>
        </div>
      </Card>
    );
  }

  if (alreadyMember) {
    return shell(
      <Card>
        <div className="space-y-4">
          {GroupIdentity}
          <p className="text-theme-sm text-fg-muted">
            {t("joinLink.alreadyMember", "You're already a member of this group.")}
          </p>
          <Button onClick={() => navigate(`/groups/${group.displayId}`)}>
            {t("joinLink.openGroup", "Open group")}
          </Button>
        </div>
      </Card>
    );
  }

  // They already have an unanswered emailed invite. Two routes to the same
  // queue would create two rows, so send them to the one they already have.
  if (pendingStatus === "PENDING") {
    return shell(
      <Card>
        <div className="space-y-4">
          {GroupIdentity}
          <p className="text-theme-sm text-fg-muted">
            {t(
              "joinLink.hasInvite",
              "You already have an invite to this group. Answer that one from your notifications."
            )}
          </p>
          <Button onClick={() => navigate("/notifications")}>
            {t("joinLink.openNotifications", "Open notifications")}
          </Button>
        </div>
      </Card>
    );
  }

  if (group.status === "CLOSED") {
    return shell(
      <Card>
        <div className="space-y-4">
          {GroupIdentity}
          <p className="text-theme-sm text-fg-muted">
            {t("joinLink.groupClosed", "This group has been closed and isn't taking new members.")}
          </p>
        </div>
      </Card>
    );
  }

  return shell(
    <Card>
      <div className="space-y-5">
        {GroupIdentity}

        <div>
          <Label>{t("joinLink.contribution", "Your starting contribution")}</Label>
          <AmountInput value={contribution} onChange={setContribution} placeholder="0" />
          <p className="mt-2 text-theme-xs text-fg-muted">
            {t(
              "joinLink.contributionHint",
              "This is what you're putting into the shared wallet. It's only credited once an admin approves you, and you can leave it at 0."
            )}
          </p>
        </div>

        {apiError && (
          <p className="text-theme-xs text-error-700 dark:text-error-400">{apiError}</p>
        )}

        <Button
          fullWidth
          loading={isJoining}
          loadingLabel={t("joinLink.sending", "Sending request…")}
          onClick={onJoin}
        >
          {t("joinLink.request", "Request to join")}
        </Button>
      </div>
    </Card>
  );
}
