import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} from "../redux/api/notification";
import { useAcceptInviteMutation, useRejectInviteMutation } from "../redux/api/invite";
import type { NotificationItem } from "../interface/notification";
import { sanitizeAmount } from "../helpers/validators";

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

export default function NotificationPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const timeAgo = useTimeAgo();

  const { data: unreadCount = 0 } = useGetUnreadCountQuery();
  const { data, isLoading } = useGetNotificationsQuery({ page: 1, limit: 20 }, { skip: !open });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const [acceptInvite, { isLoading: isAccepting }] = useAcceptInviteMutation();
  const [rejectInvite, { isLoading: isRejecting }] = useRejectInviteMutation();
  const [deleteNotification] = useDeleteNotificationMutation();

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [contribution, setContribution] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
    } catch (err: any) {
      setActionError(err?.data?.message || t("notifications.actionFailed"));
    }
  };

  const handleReject = async (inviteId: string) => {
    setActionError("");
    try {
      await rejectInvite({ inviteId }).unwrap();
    } catch (err: any) {
      setActionError(err?.data?.message || t("notifications.actionFailed"));
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label={t("notifications.toggle", "Notifications")}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07]
          flex items-center justify-center hover:bg-white/[0.08] hover:border-white/[0.12]
          active:bg-white/[0.08] active:border-white/[0.12] active:scale-[0.95]
          transition-all duration-150 group"
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.5a4 4 0 0 1 4 4v2.5l1 1.5H2L3 8V5.5a4 4 0 0 1 4-4z"
            stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"
            className="group-hover:stroke-white/60 transition-colors" />
          <path d="M5.5 11.5a1.5 1.5 0 0 0 3 0"
            stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round"
            className="group-hover:stroke-white/60 transition-colors" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full
            bg-violet-500 text-[9px] font-bold text-white flex items-center justify-center
            shadow-sm shadow-violet-500/50" translate="no">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 w-[340px] max-w-[90vw]
          bg-[#0f1118] border border-white/[0.09] rounded-xl overflow-hidden
          shadow-[0_16px_48px_rgba(0,0,0,0.5)] z-50
          animate-in fade-in slide-in-from-top-1 duration-150">

          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <p className="text-[13px] font-semibold text-[#f0eeff]">{t("notifications.title")}</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-[11px] font-medium text-violet-400/80 hover:text-violet-300 active:text-violet-300 transition-colors"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {isLoading && (
              <p className="px-4 py-8 text-center text-[12px] text-white/30">{t("notifications.loading")}</p>
            )}

            {!isLoading && notifications.length === 0 && (
              <p className="px-4 py-10 text-center text-[12px] text-white/25">{t("notifications.empty")}</p>
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
                    className={`px-4 py-3 border-b border-white/[0.04] cursor-default transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40
                      ${n.read ? "" : "bg-violet-500/[0.06]"}`}
                  >
                    <div className="flex items-start gap-2.5">
                      {!n.read && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      )}
                      <div className={`min-w-0 flex-1 ${n.read ? "pl-4" : ""}`}>
                        <p className="text-[12px] text-white/75 leading-snug" translate="no">
                          {messageFor(n)}
                        </p>
                        <p className="text-[10px] text-white/30 mt-0.5" translate="no">
                          {timeAgo(n.createdAt)}
                        </p>

                        {n.type === "GROUP_INVITE" && inviteResponse && (
                          <span
                            className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md text-[10px] font-semibold border
                              ${inviteResponse === "ACCEPTED"
                                ? "bg-green-500/10 border-green-500/25 text-green-300"
                                : "bg-red-500/10 border-red-500/20 text-red-300"}`}
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
                              className="px-3 py-1 rounded-lg text-[11px] font-semibold
                                bg-cyan-500/15 border border-cyan-500/25 text-cyan-300
                                hover:bg-cyan-500/25 active:bg-cyan-500/25 transition-colors"
                            >
                              {t("notifications.accept")}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReject(inviteId); }}
                              disabled={isRejecting}
                              className="px-3 py-1 rounded-lg text-[11px] font-semibold
                                bg-white/[0.04] border border-white/[0.08] text-white/45
                                hover:text-red-300 hover:border-red-500/30 hover:bg-red-500/[0.08]
                                active:text-red-300 active:border-red-500/30 active:bg-red-500/[0.08]
                                disabled:opacity-40 transition-colors"
                            >
                              {t("notifications.reject")}
                            </button>
                          </div>
                        )}

                        {isInvite && acceptingId === n._id && (
                          <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-[10px] text-white/35">{t("notifications.contributionLabel")}</p>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 text-xs">₹</span>
                                <input
                                  autoFocus
                                  value={contribution}
                                  onChange={(e) => setContribution(sanitizeAmount(e.target.value))}
                                  placeholder="0"
                                  inputMode="decimal"
                                  className="w-full bg-white/[0.05] border border-white/[0.09] rounded-lg pl-6 pr-2.5 py-1.5
                                    text-xs text-white placeholder-white/20 outline-none
                                    focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                                />
                              </div>
                              <button
                                onClick={() => handleAccept(inviteId)}
                                disabled={isAccepting}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold
                                  bg-cyan-400 text-black hover:bg-cyan-300 active:bg-cyan-300 disabled:opacity-40 transition-colors"
                              >
                                {t("notifications.confirm")}
                              </button>
                              <button
                                onClick={() => { setAcceptingId(null); setActionError(""); }}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                                  text-white/40 hover:text-white/70 active:text-white/70 transition-colors"
                              >
                                {t("notifications.cancel")}
                              </button>
                            </div>
                          </div>
                        )}

                        {isInvite && acceptingId === n._id && actionError && (
                          <p className="text-[10px] text-red-400/80 mt-1">{actionError}</p>
                        )}
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(n._id); }}
                        aria-label={t("notifications.delete")}
                        className="shrink-0 -mt-0.5 -mr-1 w-6 h-6 flex items-center justify-center rounded-md
                          text-white/20 hover:text-red-300 hover:bg-red-500/10 active:text-red-300 active:bg-red-500/10 transition-colors"
                      >
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
