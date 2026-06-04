export interface Category {
  _id: string;
  name: string;
  color: string;
  isSpecial?: boolean;
  expenseCount: number;
}

export interface CategoryResponse {
  message: string;
  category: Category[];
}
