export interface SplitMember {
  userId: { _id: string; name: string; email: string };
  amount: number;
}

export interface SplitEntry {
  userId: string;
  name: string;
  amount: number;
}

export interface Expense {
  _id: string;
  title: string;
  description?: string;
  amount: number;
  date: string;
  time?: string;
  category: { name: string; color: string; _id: string };
  creditCategory?: { name: string; color: string; _id: string };
  /** The Reserve this expense was paid with. On a credit expense the Reserve's
   *  wallet paid and this group owes it; on older expenses it is only a label. */
  fundedByGroup?: { _id: string; name: string; displayId: string };
  /** Set when the expense was paid on Reserve credit: the credit line's id. */
  creditLink?: string;
  paidBy: { _id: string; name: string; email: string };
  paymentType: string;
  splitBetween: SplitMember[];
}

export interface GetExpenseReport {
  _id: string;
  title: string;
  amount: number;
  date: string;
  time: string;
  groupId: string;
  isDeleted: boolean;
  category: { _id: string; name: string; color: string };
  paidBy: { _id: string; name: string; email: string };
  /** Populated on list rows when the expense is attributed to a connected group. */
  fundedByGroup?: { _id: string; name: string; displayId: string };
  paymentType: string;
  splitBetween: SplitMember[];
  updatedAt: string;
  __v: number;
}
