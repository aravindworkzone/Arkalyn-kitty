import { useTranslation } from "react-i18next";
import { PageBackground } from "../components/ui";
import NotificationList from "../components/notifications/NotificationList";

/**
 * The notification feed as a route, replacing the dropdown that hung off the
 * bell. Same page shell the rest of the app uses — see page/GroupPage.tsx.
 */
export default function NotificationsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <div className="mb-6">
          <p className="text-theme-xs font-medium tracking-widest uppercase text-brand-600 dark:text-brand-400 mb-1">
            {t("nav.inbox", "Inbox")}
          </p>
          <h1 className="text-title-sm font-semibold text-fg tracking-tight">
            {t("notifications.title")}
          </h1>
        </div>

        <NotificationList />
      </main>
    </div>
  );
}
