export type ReportPreset = 'this_month' | 'last_month' | 'all_time' | 'custom';

export interface CategoryBreakdownRow {
    categoryId: string;
    name: string;
    color: string;
    isDeleted: boolean;
    totalCents: number;
    expenseCount: number;
    sharePct: number;
}

export interface CategoryBreakdown {
    range: { start: string; end: string; preset: ReportPreset };
    totalSpendCents: number;
    expenseCount: number;
    categories: CategoryBreakdownRow[];
}

export interface CategoryBreakdownArgs {
    groupId: string;
    preset?: ReportPreset;
    startDate?: string;
    endDate?: string;
}
