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
  paidBy: { name: string; email: string };
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
  paidBy: { name: string; email: string };
  paymentType: string;
  splitBetween: SplitMember[];
  updatedAt: string;
  __v: number;
}
