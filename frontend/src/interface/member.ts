export interface GroupMember {
  _id: string;
  contribution: number;
  name: string;
  role: string;
  settlement?: boolean;
  settlementAmount?: number;
  leaveRequestedAt?: string | null;
  leftMode?: "SETTLED" | "FORFEIT" | null;
  userId: { _id: string; name: string; email: string };
}

export interface CreateGroupMember {
  _id: string;
  user: string;
  email: string;
  contribution: number;
}
