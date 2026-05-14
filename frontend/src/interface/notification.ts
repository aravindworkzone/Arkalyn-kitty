export type NotificationType =
  | "GROUP_INVITE"
  | "INVITE_ACCEPTED"
  | "INVITE_REJECTED"
  | "LEAVE_REQUESTED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "ROLE_CHANGED"
  | "MEMBER_LEFT"
  | "GROUP_DELETED";

export interface NotificationItem {
  _id: string;
  recipient: string;
  actor: { _id: string; name: string } | null;
  group: { _id: string; name: string } | null;
  type: NotificationType;
  metadata: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface PaginatedNotifications {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
}
