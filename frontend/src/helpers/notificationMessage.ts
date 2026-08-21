import type { TFunction } from "i18next";
import type { NotificationItem } from "../interface/notification";

/**
 * One line of prose for a notification.
 *
 * Lifted out of components/notifications/NotificationList.tsx once the arrival
 * toast needed the same sentence: two copies would have drifted the moment a
 * new notification type was added to one and not the other.
 *
 * The type list is open-ended on the server (chit and group-link types have no
 * strings yet), so the lookup falls through to a generic line rather than
 * rendering a raw key.
 */
export const notificationMessage = (n: NotificationItem, t: TFunction): string => {
  const actor = n.actor?.name ?? t("notifications.someone");
  // A deleted group populates to null, but the notification about it still has
  // to name the group — so the name is stamped into metadata when it is sent.
  const group =
    n.group?.name ?? (typeof n.metadata?.groupName === "string" ? n.metadata.groupName : "");
  return t([`notifications.msg.${n.type}`, "notifications.msg.default"], { actor, group });
};

export default notificationMessage;
