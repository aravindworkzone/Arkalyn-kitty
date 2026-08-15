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
  /** Connected group this spend is attributed to. Attribution only — it never
   *  affects which wallet was debited. */
  fundedByGroup?: { _id: string; name: string; displayId: string };
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
