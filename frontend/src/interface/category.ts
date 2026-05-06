export interface Category {
  _id: string;
  name: string;
  color: string;
  expenseCount: number;
}

export interface CategoryResponse {
  message: string;
  category: Category[];
}
