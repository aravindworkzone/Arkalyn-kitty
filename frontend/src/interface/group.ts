import type { PlanTier, PlanView } from "./subscription";

export const GROUP_PURPOSES = ["FAMILY", "FRIENDS", "ROOMMATES", "TEAM", "OTHER"] as const;
export type GroupPurpose = typeof GROUP_PURPOSES[number];

export interface IGroup {
  _id: string;
  displayId: string;
  name: string;
  groupType: "POOL" | "SPLIT";
  purpose?: GroupPurpose;
  balance: number;
  totalContribution: number;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Group {
  _id: string;
  name: string;
  displayId: string;
  members: string[];
  expenseCount: number;
  categoryCount: number;
  balance: number;
  purpose?: GroupPurpose;
  // Present on the single-group detail view; absent from the group-list cards.
  totalContribution?: number;
  barLength: number;
  createdAt: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MEMBER";
  status?: "ACTIVE" | "INACTIVE" | "CLOSED";
  // This group's own effective plan — present on the single-group detail view.
  // Resolved server-side by the same helper the write gates use, so gating UI on
  // it can't disagree with what the API will enforce.
  subscription?: PlanView;
  // The group's effective tier, flattened onto the group-list cards (which don't
  // carry the full plan view). Closed groups report their frozen snapshot.
  planTier?: PlanTier;
  // When this group's paid access ends. null on FREE (nothing to expire).
  planExpiresAt?: string | null;
  // Plan frozen at close — present only on CLOSED groups. Drives the frozen
  // plan badge and the clone gate, independent of any later purchase or lapse.
  planSnapshot?: { tier: PlanTier; snapshotAt?: string } | null;
  isFavorite?: boolean;
}

export interface GroupCardProps {
  group: Group;
  onClick: () => void;
  onAddExpense: () => void;
  onToggleFavorite: () => void;
  isTogglingFavorite?: boolean;
}

// "requests" holds both join approvals and leave requests.
export type SettingsTab = "addMember" | "changeRole" | "contribution" | "settlement" | "requests" | "danger";
