import type { PlanTier, PlanView } from "./subscription";

// Storage enum — mirrors Backend/models/group.model.ts. FRIENDS, ROOMMATES, TEAM
// and OTHER are LEGACY: existing groups still carry them, but they are not
// offered on the create form and all resolve to the FAMILY feature set.
// ⚠️ Keep in sync with Backend/models/group.model.ts → GROUP_PURPOSES.
export const GROUP_PURPOSES = ["FAMILY", "FRIENDS", "ROOMMATES", "TEAM", "RESERVE", "OTHER", "CHIT"] as const;
export type GroupPurpose = typeof GROUP_PURPOSES[number];

// The three types offered when creating a group.
// ⚠️ Keep in sync with Backend/models/group.model.ts → SELECTABLE_GROUP_PURPOSES.
export const SELECTABLE_GROUP_PURPOSES = ["FAMILY", "CHIT", "RESERVE"] as const;
export type SelectableGroupPurpose = typeof SELECTABLE_GROUP_PURPOSES[number];

// A group's resolved type: what its purpose means for which features it has.
export const GROUP_TYPES = ["FAMILY", "CHIT", "RESERVE"] as const;
export type GroupType = typeof GROUP_TYPES[number];

// ⚠️ Keep in sync with Backend/config/groupTypeFeatures.ts → GroupTypeFeatures.
export interface GroupTypeFeatures {
  // May record expenses and create expense categories.
  expenses: boolean;
  // May be the source of a funding link — i.e. bankroll another group.
  fundOthers: boolean;
  // May be the host of a funding link — i.e. be bankrolled by another group.
  // False only for CHIT, which is funded solely by its own members.
  receiveFunding: boolean;
  // May move money in or out of the wallet by hand — an admin-recorded
  // contribution, or a settlement paying a member out. False only for CHIT,
  // where every rupee belongs to the rotation.
  manualWalletMoves: boolean;
  // Runs a chit fund: fixed contributions per cycle, members taking turns to
  // receive the pot.
  chit: boolean;
}

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
  // The group's resolved type and the features it grants — present on the
  // single-group detail view, resolved by the same helper the write gates use.
  // Named groupTypeName rather than groupType because the schema already has an
  // unrelated (and unimplemented) groupType: "POOL" | "SPLIT" field.
  groupTypeName?: GroupType;
  features?: GroupTypeFeatures;
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
export type SettingsTab = "addMember" | "changeRole" | "contribution" | "settlement" | "requests" | "export" | "danger";

/**
 * The nav destinations the sidebar tracks for "has anything changed here?".
 *
 * `report` is not one of them — it is a breakdown of expenses with no store of
 * its own, so it reads the `expenses` stamp. The chit's three pages share the
 * one `chit` stamp for the same reason: they are three views of one board.
 */
export type GroupSectionKey =
  | "overview"
  | "credits"
  | "expenses"
  | "categories"
  | "activity"
  | "connections"
  | "manage"
  | "chit";

/** ISO timestamp of the last write behind each section, or null if it is empty. */
export type GroupSectionUpdates = Record<GroupSectionKey, string | null>;
