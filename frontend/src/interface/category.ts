export type CategoryType = "EXPENSE" | "CREDIT";

export interface Category {
  _id: string;
  name: string;
  color: string;
  type?: CategoryType;
  isSpecial?: boolean;
  // Generic usage count: number of expenses (EXPENSE) or credits (CREDIT)
  // referencing this category. Drives the delete-blocked state.
  expenseCount: number;
  // Soft spend cap for the whole group, in cents — a lifetime total for this
  // category, not a monthly one. `null`/absent = no limit. Expense-only.
  limitCents?: number | null;
  // Lifetime spend in this category, in cents — measured against limitCents.
  spentCents?: number;
}

export interface CategoryResponse {
  message: string;
  category: Category[];
}
