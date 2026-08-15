import { useTranslation } from "react-i18next";
import { PageBackground, PageContainer } from "../components/ui";
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

      {/* A notification is one line of prose plus a timestamp — stretched to
          1150px it becomes a stripe of empty canvas, so the feed keeps the
          narrower measure even though the shell is wider now. */}
      <PageContainer width="form">
        <div>
          <p className="text-theme-xs font-medium tracking-widest uppercase text-brand-600 dark:text-brand-400 mb-1.5">
            {t("nav.inbox", "Inbox")}
          </p>
          <h1 className="text-title-sm lg:text-title-md font-semibold text-fg tracking-tight">
            {t("notifications.title")}
          </h1>
        </div>

        <NotificationList />
      </PageContainer>
    </div>
  );
}
