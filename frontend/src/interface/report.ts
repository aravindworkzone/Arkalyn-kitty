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

// member-breakdown and spend-trend reports take the same range args.
export type ReportRangeArgs = CategoryBreakdownArgs;

// Member breakdown additionally picks the attribution mode.
export type MemberBy = 'paid' | 'spent';
export type MemberBreakdownArgs = ReportRangeArgs & { by?: MemberBy };

export interface MemberBreakdownRow {
    userId: string;
    name: string;
    email: string;
    totalCents: number;
    expenseCount: number;
    sharePct: number;
}

export interface MemberBreakdown {
    range: { start: string; end: string; preset: ReportPreset };
    totalSpendCents: number;
    expenseCount: number;
    members: MemberBreakdownRow[];
}

export type TrendGranularity = 'day' | 'week' | 'month';

export interface TrendPoint {
    periodStart: string;
    totalCents: number;
    expenseCount: number;
}

export interface SpendTrend {
    range: { start: string; end: string; preset: ReportPreset };
    granularity: TrendGranularity;
    totalSpendCents: number;
    expenseCount: number;
    points: TrendPoint[];
}
