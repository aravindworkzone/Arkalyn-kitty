import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../helpers/cn";
import { useGetUnreadCountQuery } from "../redux/api/notification";

/**
 * Bell + unread count, linking to /notifications.
 *
 * This replaces the dropdown panel that used to hang off it. The feed now has
 * its own route, so the trigger is a plain link — which also means the unread
 * count is the only thing this component has to know about, and the placement
 * props the popover needed are gone.
 */

interface NotificationBellProps {
  className?: string;
}

export default function NotificationBell({ className }: NotificationBellProps) {
  const { t } = useTranslation();
  const { data: unreadCount = 0 } = useGetUnreadCountQuery();

  return (
    <NavLink
      to="/notifications"
      aria-label={
        unreadCount > 0
          ? t("notifications.unreadAria", { count: unreadCount, defaultValue: "Notifications, {{count}} unread" })
          : t("notifications.toggle", "Notifications")
      }
      className={({ isActive }) =>
        cn(
          "relative w-8 h-8 rounded-lg border flex items-center justify-center",
          "transition-all duration-150 active:scale-[0.95]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
          isActive
            ? "bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-400"
            : "bg-surface-hover border-line text-fg-muted hover:text-fg",
          className
        )
      }
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M7 1.5a4 4 0 0 1 4 4v2.5l1 1.5H2L3 8V5.5a4 4 0 0 1 4-4z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5.5 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>

      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full
            bg-brand-500 text-theme-2xs font-bold text-on-accent flex items-center justify-center
            shadow-theme-xs"
          translate="no"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </NavLink>
  );
}
