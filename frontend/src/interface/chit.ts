/**
 * Chit fund types, mirroring what Backend/services/chit.service.ts resolves.
 *
 * ⚠️ Keep in sync with Backend/models/chit_*.model.ts and getChitBoardService.
 *
 * Two things about this shape are load-bearing rather than incidental:
 *
 *  - `state` is ONE three-valued field, not `status` plus a `missed` boolean.
 *    Two fields would invite the client to combine them, and combining them means
 *    reading the clock during render — which the React Compiler forbids and which
 *    is exactly why the server resolves it.
 *
 *  - `memberDues` and `tally` are OPTIONAL. The server omits them entirely for
 *    anyone who cannot manage the chit; they are never sent empty. An empty array
 *    would render as "nobody has paid", which is a different and wrong statement.
 */

export type ChitSchemeStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type ChitCycleStatus = "COLLECTING" | "PAID";
export type ChitDueState = "PAID" | "PENDING" | "MISSED";
export type ChitPayoutState = "RECEIVED" | "CURRENT" | "UPCOMING";

export interface ChitPersonRef {
  userId: string;
  name: string;
  isMe: boolean;
}

export interface ChitSchemeView {
  schemeId: string;
  status: ChitSchemeStatus;
  amountPerMember: number; // rupees
  potPerCycle: number; // rupees
  totalCycles: number;
  cyclesPaid: number;
  startDate: string;
  cycleIntervalDays: number;
  dueDays: number;
  participantCount: number;
  organizer: ChitPersonRef;
  /**
   * Whether the caller may record payments and release payouts. Resolved by the
   * server and never re-derived here: on the Free plan every member is an ADMIN,
   * so a role-based client check would be wrong in the default case.
   */
  canManage: boolean;
  /**
   * Whether the caller sees the whole group's figures — the collection meter and
   * the per-member roster — rather than only their own dues.
   *
   * Wider than canManage: an ADMIN reads everything but still cannot record a
   * payment, so the roster renders read-only for them. A plain MEMBER gets the
   * narrow view. Note that a Free group has no MEMBER role at all, so the narrow
   * view only appears on a plan carrying memberRole.
   */
  canViewAll: boolean;
}

export interface ChitCycleView {
  cycleId: string;
  cycleNumber: number;
  status: ChitCycleStatus;
  recipient: ChitPersonRef;
  expectedAmount: number;
  payoutAmount: number;
  // Omitted entirely when the caller is not canViewAll — the server sends no key
  // rather than a zero, so `collectedAmount ?? 0` can never be mistaken for "the
  // group has collected nothing".
  collectedAmount?: number;
  shortfallAmount?: number;
  collectedPct?: number;
  dueDate: string;
  paidAt: string | null;
  overdue: boolean;
  isCurrent: boolean;
}

export interface ChitMyDue {
  dueId: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  state: ChitDueState;
}

export interface ChitMyPayout {
  position: number;
  cycleNumber: number;
  state: ChitPayoutState;
  expectedOn: string | null;
  expectedAmount: number;
  receivedOn: string | null;
  receivedAmount: number | null;
}

/**
 * The fixed turn order — public to every member, which is the transparency the
 * feature exists for. Note what is absent: no due state, no amount owed. Whose
 * turn it is, is everyone's business; whether Ravi paid this month is not.
 */
export interface ChitTurn {
  position: number;
  cycleNumber: number;
  userId: string;
  name: string;
  isMe: boolean;
  payoutState: ChitPayoutState;
  expectedOn: string | null;
  receivedOn: string | null;
  receivedAmount: number | null;
}

export interface ChitHistoryEntry {
  cycleNumber: number;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  state: ChitDueState;
}

/** Organizer only. */
export interface ChitMemberDue {
  dueId: string;
  userId: string;
  name: string;
  isMe: boolean;
  position: number;
  amount: number;
  paidAt: string | null;
  paymentType: string | null;
  state: ChitDueState;
}

export interface ChitBoard {
  scheme: ChitSchemeView | null;
  cycle: ChitCycleView | null;
  myDue: ChitMyDue | null;
  myPayout: ChitMyPayout | null;
  turns: ChitTurn[];
  myHistory: ChitHistoryEntry[];
  myArrears: { count: number; amount: number } | null;
  memberDues?: ChitMemberDue[];
  tally?: { paid: number; pending: number; missed: number; total: number };
  asOf: string;
}

export interface ChitHistoryRow {
  cycleId: string;
  cycleNumber: number;
  status: ChitCycleStatus;
  recipient: ChitPersonRef;
  expectedAmount: number;
  payoutAmount: number;
  // Same narrowing as ChitCycleView above.
  collectedAmount?: number;
  shortfallAmount?: number;
  dueDate: string;
  paidAt: string | null;
  myDue: { amount: number; paidAt: string | null; state: ChitDueState } | null;
}
