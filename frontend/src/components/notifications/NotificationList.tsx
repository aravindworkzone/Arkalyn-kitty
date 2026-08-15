import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} from "../../redux/api/notification";
import { useAcceptInviteMutation, useRejectInviteMutation } from "../../redux/api/invite";
import type { NotificationItem } from "../../interface/notification";
import { sanitizeAmount } from "../../helpers/validators";
import { Input } from "../ui";

const useTimeAgo = () => {
  const { t } = useTranslation();
  return (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t("notifications.justNow");
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };
};

/**
 * The notification feed, lifted out of the old dropdown panel.
 *
 * It used to live inside a 340px popover anchored to the bell. That capped the
 * list at 400px of scroll and forced a `max-w-[90vw]` on phones, which is a
 * cramped home for rows that can grow an amount input and two actions. It is a
 * route now — components/NotificationBell.tsx links to it — so this renders at
 * the page's full width and the panel's positioning props are gone with it.
 *
 * Fetching is unconditional here: the old `skip: !open` existed only because the
 * dropdown was usually shut.
 */
export default function NotificationList() {
  const { t } = useTranslation();
  const timeAgo = useTimeAgo();

  const { data: unreadCount = 0 } = useGetUnreadCountQuery();
  const { data, isLoading } = useGetNotificationsQuery({ page: 1, limit: 20 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const [acceptInvite, { isLoading: isAccepting }] = useAcceptInviteMutation();
  const [rejectInvite, { isLoading: isRejecting }] = useRejectInviteMutation();
  const [deleteNotification] = useDeleteNotificationMutation();

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [contribution, setContribution] = useState("");
  const [actionError, setActionError] = useState("");

  const notifications = data?.items ?? [];

  const messageFor = (n: NotificationItem): string => {
    const actor = n.actor?.name ?? t("notifications.someone");
    const group =
      n.group?.name ?? (typeof n.metadata?.groupName === "string" ? n.metadata.groupName : "");
    return t([`notifications.msg.${n.type}`, "notifications.msg.default"], { actor, group });
  };

  const inviteIdOf = (n: NotificationItem): string | null =>
    typeof n.metadata?.inviteId === "string" ? n.metadata.inviteId : null;

  // Once the invite is accepted/rejected the backend stamps the response on the
  // notification so we can show a static status instead of the action buttons.
  const inviteResponseOf = (n: NotificationItem): "ACCEPTED" | "REJECTED" | null => {
    const r = n.metadata?.inviteResponse;
    return r === "ACCEPTED" || r === "REJECTED" ? r : null;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id).unwrap();
    } catch {
      /* refetch on tag invalidation keeps the list consistent */
    }
  };

  const handleAccept = async (inviteId: string) => {
    setActionError("");
    const amount = Number(contribution || 0);
    if (Number.isNaN(amount) || amount < 0) {
      setActionError(t("notifications.invalidAmount"));
      return;
    }
    try {
      await acceptInvite({ inviteId, contribution: amount }).unwrap();
      setAcceptingId(null);
      setContribution("");
    } catch (err: unknown) {
      setActionError(
        (err as { data?: { message?: string } })?.data?.message ?? t("notifications.actionFailed")
      );
    }
  };

  const handleReject = async (inviteId: string) => {
    setActionError("");
    try {
      await rejectInvite({ inviteId }).unwrap();
    } catch (err: unknown) {
      setActionError(
        (err as { data?: { message?: string } })?.data?.message ?? t("notifications.actionFailed")
      );
    }
  };

  return (
    <div className="rounded-2xl bg-surface-raised border border-line overflow-hidden shadow-theme-xs">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
        <p className="text-theme-sm font-semibold text-fg">
          {t("notifications.title")}
          {unreadCount > 0 && (
            <span className="ml-2 text-theme-xs font-medium text-fg-muted" translate="no">
              {unreadCount}
            </span>
          )}
        </p>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="text-theme-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-md"
          >
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      <div>
        {isLoading && (
          <p className="px-4 py-8 text-center text-theme-xs text-fg-muted">{t("notifications.loading")}</p>
        )}

        {!isLoading && notifications.length === 0 && (
          <p className="px-4 py-14 text-center text-theme-xs text-fg-muted">{t("notifications.empty")}</p>
        )}

        {!isLoading &&
          notifications.map((n) => {
            const inviteId = inviteIdOf(n);
            const inviteResponse = inviteResponseOf(n);
            const isInvite = n.type === "GROUP_INVITE" && inviteId !== null && !inviteResponse;
            return (
              <div
                key={n._id}
                onClick={() => !n.read && markRead(n._id)}
                role={!n.read ? "button" : undefined}
                tabIndex={!n.read ? 0 : undefined}
                onKeyDown={(e) => {
                  if (!n.read && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    markRead(n._id);
                  }
                }}
                aria-label={!n.read ? t("notifications.markRead", "Mark notification as read") : undefined}
                className={`px-5 py-4 border-b border-line last:border-b-0 cursor-default transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40
                  ${n.read ? "" : "bg-brand-500/[0.06]"}`}
              >
                <div className="flex items-start gap-2.5">
                  {!n.read && (
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 dark:bg-brand-400 shrink-0" />
                  )}
                  <div className={`min-w-0 flex-1 ${n.read ? "pl-4" : ""}`}>
                    <p className="text-theme-sm text-fg leading-snug" translate="no">
                      {messageFor(n)}
                    </p>
                    <p className="text-theme-xs text-fg-muted mt-0.5" translate="no">
                      {timeAgo(n.createdAt)}
                    </p>

                    {n.type === "GROUP_INVITE" && inviteResponse && (
                      <span
                        className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md text-theme-2xs font-semibold border
                          ${inviteResponse === "ACCEPTED"
                            ? "bg-success-50 border-success-200 text-success-700 dark:bg-success-500/15 dark:border-success-500/25 dark:text-success-400"
                            : "bg-error-50 border-error-200 text-error-700 dark:bg-error-500/15 dark:border-error-500/25 dark:text-error-400"}`}
                      >
                        {inviteResponse === "ACCEPTED"
                          ? t("notifications.responseAccepted")
                          : t("notifications.responseRejected")}
                      </span>
                    )}

                    {isInvite && acceptingId !== n._id && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActionError(""); setContribution(""); setAcceptingId(n._id); }}
                          className="px-3 py-1.5 rounded-lg text-theme-xs font-semibold
                            bg-brand-500 border border-brand-500 text-on-accent
                            hover:bg-brand-600 active:bg-brand-600 transition-colors"
                        >
                          {t("notifications.accept")}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReject(inviteId); }}
                          disabled={isRejecting}
                          className="px-3 py-1.5 rounded-lg text-theme-xs font-semibold
                            bg-surface-hover border border-line text-fg-muted
                            hover:text-error-600 hover:border-error-500/40 hover:bg-error-500/10
                            dark:hover:text-error-400
                            disabled:opacity-40 transition-colors"
                        >
                          {t("notifications.reject")}
                        </button>
                      </div>
                    )}

                    {isInvite && acceptingId === n._id && (
                      <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <p className="text-theme-xs text-fg-muted">{t("notifications.contributionLabel")}</p>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 max-w-[180px]">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted text-theme-xs z-10">₹</span>
                            <Input
                              size="sm"
                              className="pl-6"
                              autoFocus
                              value={contribution}
                              onChange={(e) => setContribution(sanitizeAmount(e.target.value))}
                              placeholder="0"
                              inputMode="decimal"
                              aria-label={t("notifications.contributionLabel")}
                            />
                          </div>
                          <button
                            onClick={() => handleAccept(inviteId)}
                            disabled={isAccepting}
                            className="px-3 py-1.5 rounded-lg text-theme-xs font-semibold
                              bg-brand-500 text-on-accent hover:bg-brand-600 active:bg-brand-600 disabled:opacity-40 transition-colors"
                          >
                            {t("notifications.confirm")}
                          </button>
                          <button
                            onClick={() => { setAcceptingId(null); setActionError(""); }}
                            className="px-2.5 py-1.5 rounded-lg text-theme-xs font-medium
                              text-fg-muted hover:text-fg active:text-fg transition-colors"
                          >
                            {t("notifications.cancel")}
                          </button>
                        </div>
                      </div>
                    )}

                    {isInvite && acceptingId === n._id && actionError && (
                      <p className="text-theme-xs text-error-600 dark:text-error-400 mt-1">{actionError}</p>
                    )}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(n._id); }}
                    aria-label={t("notifications.delete")}
                    className="shrink-0 -mt-0.5 -mr-1 w-7 h-7 flex items-center justify-center rounded-md
                      text-fg-muted hover:text-error-600 hover:bg-error-500/10 dark:hover:text-error-400 transition-colors"
                  >
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
