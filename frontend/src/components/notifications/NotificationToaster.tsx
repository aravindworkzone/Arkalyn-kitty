import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { socket } from "../../socket/socket";
import { SOCKET_EVENTS } from "../../socket/event";
import { notificationMessage } from "../../helpers/notificationMessage";
import { isBacklogShown, markBacklogShown } from "../../helpers/notificationBacklog";
import { useGetNotificationsQuery, useGetUnreadCountQuery } from "../../redux/api/notification";
import type { NotificationItem } from "../../interface/notification";

/**
 * Pops a notification the moment it arrives — and, once per sign-in, whatever
 * was still unread from before the session started.
 *
 * Two sources, one stack:
 *
 *   - Live. The server already pushes every notification over
 *     `notification:new` — socket/listener/notification.listener.tsx has
 *     listened for it all along, but only to invalidate the RTK cache, so the
 *     payload went unread. This renders it. The listener keeps its job: one of
 *     them refreshes the data, the other shows it.
 *
 *   - Backlog. A socket only carries what happens while the tab is open, so
 *     anything sent while the user was signed out reached them as nothing more
 *     than a higher number on the bell — which is exactly the case a
 *     notification most needs to be seen. Those are fetched once at sign-in and
 *     popped the same way. See helpers/notificationBacklog.ts for what "once"
 *     means and why it is scoped to the session.
 *
 * Deliberately NOT rendered while the feed itself is open — /notifications
 * already shows these rows, and a toast over them would announce something the
 * user is looking at.
 */

/** How long a toast stays up. Long enough to read two lines, not so long that a
 *  burst of them stacks into a wall. */
const DISMISS_MS = 6500;

/** Older toasts are dropped rather than queued: the feed holds the rest. */
const MAX_VISIBLE = 3;

/** Stable identity for "no backlog" — a fresh [] would re-run the memo below. */
const NONE: NotificationItem[] = [];

/**
 * The socket payload is JSON off the wire, so it is narrowed before it reaches
 * anything that renders it — a malformed push should drop, not throw inside a
 * listener where React can't catch it.
 */
const asNotification = (payload: unknown): NotificationItem | null => {
  if (!payload || typeof payload !== "object") return null;
  const n = payload as Partial<NotificationItem>;
  if (typeof n._id !== "string" || typeof n.type !== "string") return null;
  return n as NotificationItem;
};

export default function NotificationToaster() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [arrived, setArrived] = useState<NotificationItem[]>([]);
  // Ids the user closed, or that timed out. Held apart from the two sources
  // because the backlog is derived from a query that can refetch under us, and
  // a dismissed toast must not come back when the cache updates.
  const [dismissed, setDismissed] = useState<readonly string[]>([]);

  // Read ONCE, at mount, through a lazy initialiser — pure, unlike reading
  // sessionStorage on every render. The flag is written in an effect below, and
  // a live read would empty the backlog on the very next render, before any of
  // it had been on screen long enough to see.
  const [wantsBacklog] = useState(() => !isBacklogShown());

  const onFeed = pathname === "/notifications";

  // Already subscribed app-wide by components/NotificationBell.tsx, so reading
  // it here is free — and it spares the list request entirely for the common
  // case of signing in with nothing waiting.
  const { data: unreadCount = 0 } = useGetUnreadCountQuery();
  const { data: unreadFeed } = useGetNotificationsQuery(
    { page: 1, limit: MAX_VISIBLE, unread: true },
    { skip: !wantsBacklog || unreadCount === 0 }
  );

  const backlog = wantsBacklog ? unreadFeed?.items ?? NONE : NONE;

  // Live arrivals first: the newest thing that just happened outranks a backlog
  // item the user has already been sitting on.
  const visible = useMemo(() => {
    const out: NotificationItem[] = [];
    const seen = new Set<string>();
    for (const n of [...arrived, ...backlog]) {
      // A live arrival is unread too, so it can turn up in both sources.
      if (seen.has(n._id) || dismissed.includes(n._id)) continue;
      seen.add(n._id);
      out.push(n);
      if (out.length === MAX_VISIBLE) break;
    }
    return out;
  }, [arrived, backlog, dismissed]);

  useEffect(() => {
    // No listener at all while the feed is open, rather than a filter inside
    // the handler — it also means anything that arrived while reading the feed
    // is not waiting to pop the moment the user navigates away.
    if (onFeed) return;

    const onNew = (payload: unknown) => {
      const item = asNotification(payload);
      if (!item) return;
      // De-duped by id: a reconnect can replay a push, and the same
      // notification arriving twice should not stack twice.
      setArrived((prev) => [item, ...prev.filter((x) => x._id !== item._id)].slice(0, MAX_VISIBLE));
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    };
  }, [onFeed]);

  // Spent as soon as the backlog resolves to something worth showing. Writing an
  // external store from an effect is the sanctioned use of one: it is not React
  // state, so there is no cascading render.
  useEffect(() => {
    if (backlog.length > 0) markBacklogShown();
  }, [backlog]);

  // One timer for the stack, retiring the oldest toast. A timer per toast would
  // need a ref map to survive re-renders; this re-arms on every change and each
  // toast still gets at least DISMISS_MS on screen.
  useEffect(() => {
    if (visible.length === 0) return;
    const oldest = visible[visible.length - 1]._id;
    const timer = setTimeout(() => {
      setDismissed((prev) => (prev.includes(oldest) ? prev : [...prev, oldest]));
    }, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  // Dismissal is recorded, never subtracted from a list: the backlog is derived
  // from the query, so removing a row there would only last until the next
  // refetch brought it back.
  const dismiss = (id: string) =>
    setDismissed((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const open = () => {
    navigate("/notifications");
    setDismissed((prev) => [...prev, ...visible.map((v) => v._id).filter((vid) => !prev.includes(vid))]);
  };

  // Nothing on screen while the feed is open — the page the user just opened
  // says the same thing at more length. Hidden rather than cleared: emptying the
  // stack would be a setState from an effect, and the dismiss timer drains it on
  // its own while it is out of sight.
  if (onFeed || visible.length === 0) return null;

  return (
    <div
      // polite, not assertive: a notification is worth announcing, never worth
      // interrupting what the screen reader is already saying.
      role="status"
      aria-live="polite"
      aria-label={t("notifications.title")}
      className="fixed z-toast bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[360px]
        flex flex-col gap-2 pb-safe pointer-events-none"
    >
      {visible.map((n) => (
        <div
          key={n._id}
          style={{ animation: "fadeUp 0.22s ease-out both" }}
          className="pointer-events-auto flex items-start gap-2.5 rounded-2xl
            bg-surface-overlay border border-line shadow-theme-md px-4 py-3"
        >
          <span
            aria-hidden="true"
            className="shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center
              bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5a4 4 0 0 1 4 4v2.5l1 1.5H2L3 8V5.5a4 4 0 0 1 4-4z" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.5 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>

          {/* The body is the link into the feed. A button rather than the whole
              card, so the dismiss control below is a sibling and not a button
              nested inside one. */}
          <button
            type="button"
            onClick={open}
            className="min-w-0 flex-1 text-left rounded-md
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <p className="text-theme-sm text-fg leading-snug" translate="no">
              {notificationMessage(n, t)}
            </p>
            <p className="text-theme-xs text-fg-muted mt-0.5">
              {t("notifications.viewAll", "View all notifications")}
            </p>
          </button>

          <button
            type="button"
            onClick={() => dismiss(n._id)}
            aria-label={t("notifications.dismiss", "Dismiss")}
            className="shrink-0 -mt-0.5 -mr-1 w-7 h-7 flex items-center justify-center rounded-md
              text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
