import type { PlanTier } from "./subscription";

export interface IGroup {
  _id: string;
  displayId: string;
  name: string;
  groupType: "POOL" | "SPLIT";
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
  // Present on the single-group detail view; absent from the group-list cards.
  totalContribution?: number;
  barLength: number;
  createdAt: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MEMBER";
  status?: "ACTIVE" | "INACTIVE" | "CLOSED";
  // Plan frozen at close — present only on CLOSED groups. Drives the frozen
  // plan badge and the clone gate, independent of the owner's current tier.
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

export type SettingsTab = "addMember" | "changeRole" | "contribution" | "settlement" | "leaveRequests" | "danger";
