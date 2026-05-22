import mongoose from 'mongoose';
import Expense from '../models/expense.model';
import Category from '../models/category.model';
import User from '../models/user.model';
import type { ReportPreset } from '../validators/report.validator';

interface ResolvedRange {
    start: Date;
    end: Date;
    preset: ReportPreset;
}

const resolveRange = (
    preset: ReportPreset | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    groupCreatedAt: Date,
): ResolvedRange => {
    const now = new Date();
    const effective: ReportPreset =
        preset ?? (startDate || endDate ? 'custom' : 'all_time');

    if (effective === 'this_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { start, end: now, preset: 'this_month' };
    }
    if (effective === 'last_month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start, end, preset: 'last_month' };
    }
    if (effective === 'all_time') {
        return { start: groupCreatedAt, end: now, preset: 'all_time' };
    }
    return {
        start: new Date(startDate!),
        end: new Date(endDate!),
        preset: 'custom',
    };
};

interface CategoryRow {
    categoryId: string;
    name: string;
    color: string;
    isDeleted: boolean;
    totalCents: number;
    expenseCount: number;
    sharePct: number;
}

export interface CategoryBreakdownResult {
    range: { start: string; end: string; preset: ReportPreset };
    totalSpendCents: number;
    expenseCount: number;
    categories: CategoryRow[];
}

interface AggRow {
    _id: mongoose.Types.ObjectId;
    totalCents: number;
    expenseCount: number;
}

export const categoryBreakdownService = async (data: {
    groupId: mongoose.Types.ObjectId;
    groupCreatedAt: Date;
    preset?: ReportPreset;
    startDate?: string;
    endDate?: string;
}): Promise<CategoryBreakdownResult> => {
    const range = resolveRange(data.preset, data.startDate, data.endDate, data.groupCreatedAt);

    const agg = await Expense.aggregate<AggRow>([
        {
            $match: {
                groupId: data.groupId,
                isDeleted: false,
                date: { $gte: range.start, $lte: range.end },
            },
        },
        {
            $group: {
                _id: '$category',
                totalCents: { $sum: '$amount' },
                expenseCount: { $sum: 1 },
            },
        },
    ]);

    const baseRange = {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        preset: range.preset,
    };

    if (agg.length === 0) {
        return {
            range: baseRange,
            totalSpendCents: 0,
            expenseCount: 0,
            categories: [],
        };
    }

    const categories = await Category
        .find({ _id: { $in: agg.map((r) => r._id) } })
        .select('_id name color isDeleted')
        .lean();

    const catMap = new Map(categories.map((c) => [String(c._id), c]));

    const totalSpendCents = agg.reduce((s, r) => s + r.totalCents, 0);
    const expenseCount = agg.reduce((s, r) => s + r.expenseCount, 0);

    const rows: CategoryRow[] = agg.map((r) => {
        const cat = catMap.get(String(r._id));
        return {
            categoryId: String(r._id),
            name: cat?.name ?? 'Unknown category',
            color: cat?.color ?? '#94a3b8',
            isDeleted: cat?.isDeleted ?? false,
            totalCents: r.totalCents,
            expenseCount: r.expenseCount,
            sharePct: Math.round((r.totalCents / totalSpendCents) * 1000) / 10,
        };
    });

    rows.sort((a, b) => b.totalCents - a.totalCents);

    return {
        range: baseRange,
        totalSpendCents,
        expenseCount,
        categories: rows,
    };
};

/* ------------------------------------------------------------------ *
 *  Per-member spend breakdown — who paid for how much.
 * ------------------------------------------------------------------ */

interface MemberRow {
    userId: string;
    name: string;
    email: string;
    totalCents: number;
    expenseCount: number;
    sharePct: number;
}

export interface MemberBreakdownResult {
    range: { start: string; end: string; preset: ReportPreset };
    totalSpendCents: number;
    expenseCount: number;
    members: MemberRow[];
}

interface MemberAggRow {
    _id: mongoose.Types.ObjectId;
    totalCents: number;
    expenseCount: number;
}

export const memberBreakdownService = async (data: {
    groupId: mongoose.Types.ObjectId;
    groupCreatedAt: Date;
    preset?: ReportPreset;
    startDate?: string;
    endDate?: string;
}): Promise<MemberBreakdownResult> => {
    const range = resolveRange(data.preset, data.startDate, data.endDate, data.groupCreatedAt);

    // Grouped by `paidBy`. Amounts sum the raw stored cents — aggregation does
    // not run Mongoose getters, so `totalCents` is genuinely in cents.
    const agg = await Expense.aggregate<MemberAggRow>([
        {
            $match: {
                groupId: data.groupId,
                isDeleted: false,
                date: { $gte: range.start, $lte: range.end },
            },
        },
        {
            $group: {
                _id: '$paidBy',
                totalCents: { $sum: '$amount' },
                expenseCount: { $sum: 1 },
            },
        },
    ]);

    const baseRange = {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        preset: range.preset,
    };

    if (agg.length === 0) {
        return { range: baseRange, totalSpendCents: 0, expenseCount: 0, members: [] };
    }

    const users = await User
        .find({ _id: { $in: agg.map((r) => r._id) } })
        .select('_id name email')
        .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const totalSpendCents = agg.reduce((s, r) => s + r.totalCents, 0);
    const expenseCount = agg.reduce((s, r) => s + r.expenseCount, 0);

    const members: MemberRow[] = agg
        .map((r) => {
            const u = userMap.get(String(r._id));
            return {
                userId: String(r._id),
                name: u?.name ?? 'Unknown member',
                email: u?.email ?? '',
                totalCents: r.totalCents,
                expenseCount: r.expenseCount,
                sharePct: Math.round((r.totalCents / totalSpendCents) * 1000) / 10,
            };
        })
        .sort((a, b) => b.totalCents - a.totalCents);

    return { range: baseRange, totalSpendCents, expenseCount, members };
};

/* ------------------------------------------------------------------ *
 *  Spend trend — total spend bucketed over time.
 * ------------------------------------------------------------------ */

type Granularity = 'day' | 'week' | 'month';

interface TrendPoint {
    periodStart: string;
    totalCents: number;
    expenseCount: number;
}

export interface SpendTrendResult {
    range: { start: string; end: string; preset: ReportPreset };
    granularity: Granularity;
    totalSpendCents: number;
    expenseCount: number;
    points: TrendPoint[];
}

interface TrendAggRow {
    _id: Date;
    totalCents: number;
    expenseCount: number;
}

export const spendTrendService = async (data: {
    groupId: mongoose.Types.ObjectId;
    groupCreatedAt: Date;
    preset?: ReportPreset;
    startDate?: string;
    endDate?: string;
}): Promise<SpendTrendResult> => {
    const range = resolveRange(data.preset, data.startDate, data.endDate, data.groupCreatedAt);

    // Pick a bucket size that keeps the chart readable for the chosen span.
    const spanDays = (range.end.getTime() - range.start.getTime()) / 86_400_000;
    const granularity: Granularity = spanDays <= 31 ? 'day' : spanDays <= 182 ? 'week' : 'month';

    const agg = await Expense.aggregate<TrendAggRow>([
        {
            $match: {
                groupId: data.groupId,
                isDeleted: false,
                date: { $gte: range.start, $lte: range.end },
            },
        },
        {
            $group: {
                _id: { $dateTrunc: { date: '$date', unit: granularity } },
                totalCents: { $sum: '$amount' },
                expenseCount: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const baseRange = {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        preset: range.preset,
    };

    const totalSpendCents = agg.reduce((s, r) => s + r.totalCents, 0);
    const expenseCount = agg.reduce((s, r) => s + r.expenseCount, 0);

    // Only periods with spend are returned — empty buckets are omitted.
    const points: TrendPoint[] = agg.map((r) => ({
        periodStart: new Date(r._id).toISOString(),
        totalCents: r.totalCents,
        expenseCount: r.expenseCount,
    }));

    return { range: baseRange, granularity, totalSpendCents, expenseCount, points };
};
