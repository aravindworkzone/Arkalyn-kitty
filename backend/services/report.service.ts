import mongoose from 'mongoose';
import Expense from '../models/expense.model';
import Category from '../models/category.model';
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
