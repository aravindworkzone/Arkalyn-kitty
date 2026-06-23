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
}

export interface CategoryResponse {
  message: string;
  category: Category[];
}
