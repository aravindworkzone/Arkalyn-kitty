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
  balance: number;
  barLength: number;
  createdAt: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MEMBER";
  status?: "ACTIVE" | "INACTIVE" | "CLOSED";
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
