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
 *  Per-member spend breakdown — either who paid (payer) or who consumed
 *  the spend (split shares, with unsplit items charged to the payer).
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
    /** 'paid' = grouped by payer; 'spent' = consumption (split shares + unsplit charged to payer). */
    by?: 'paid' | 'spent';
}): Promise<MemberBreakdownResult> => {
    const range = resolveRange(data.preset, data.startDate, data.endDate, data.groupCreatedAt);
    const by = data.by ?? 'spent';

    const matchStage = {
        groupId: data.groupId,
        isDeleted: false,
        date: { $gte: range.start, $lte: range.end },
    };

    // Two attribution modes. Amounts sum the raw stored cents — aggregation
    // does not run Mongoose getters, so `totalCents` is genuinely in cents.
    //   • paid  — group by `paidBy`, summing the full expense amount.
    //   • spent — consumption. Split expenses are attributed to each split
    //     member by their share; expenses logged WITHOUT a split are attributed
    //     in full to whoever paid (an untracked item is treated as consumed by
    //     its payer). This keeps the "spent" total equal to the "paid" total and
    //     mirrors the expense-list drill-down filter (splitBetween.userId, or
    //     paidBy on unsplit rows) so the chart and the drilled-in list reconcile.
    const pipeline =
        by === 'paid'
            ? [
                  { $match: matchStage },
                  {
                      $group: {
                          _id: '$paidBy',
                          totalCents: { $sum: '$amount' },
                          expenseCount: { $sum: 1 },
                      },
                  },
              ]
            : [
                  { $match: matchStage },
                  {
                      // Split rows → per-share; unsplit rows → full amount to payer.
                      $facet: {
                          split: [
                              { $match: { 'splitBetween.0': { $exists: true } } },
                              { $unwind: '$splitBetween' },
                              {
                                  $group: {
                                      _id: '$splitBetween.userId',
                                      totalCents: { $sum: '$splitBetween.amount' },
                                      expenseCount: { $sum: 1 },
                                  },
                              },
                          ],
                          unsplit: [
                              { $match: { 'splitBetween.0': { $exists: false } } },
                              {
                                  $group: {
                                      _id: '$paidBy',
                                      totalCents: { $sum: '$amount' },
                                      expenseCount: { $sum: 1 },
                                  },
                              },
                          ],
                      },
                  },
                  // Merge the two facets and re-group so a member who both shared
                  // in splits and paid for unsplit items lands in one row.
                  { $project: { merged: { $concatArrays: ['$split', '$unsplit'] } } },
                  { $unwind: '$merged' },
                  {
                      $group: {
                          _id: '$merged._id',
                          totalCents: { $sum: '$merged.totalCents' },
                          expenseCount: { $sum: '$merged.expenseCount' },
                      },
                  },
              ];

    const agg = await Expense.aggregate<MemberAggRow>(pipeline);

    const baseRange = {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        preset: range.preset,
    };

    if (agg.length === 0) {
        return { range: baseRange, totalSpendCents: 0, expenseCount: 0, members: [] };
    }

    // Distinct expenses contributing to this view. Both modes now cover every
    // expense in range (spent attributes unsplit rows to the payer), so a plain
    // count is correct — summing per-member `agg` counts would double-count an
    // expense shared across members.
    const totalExpenseCount = await Expense.countDocuments(matchStage);

    const users = await User
        .find({ _id: { $in: agg.map((r) => r._id) } })
        .select('_id name email')
        .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const totalSpendCents = agg.reduce((s, r) => s + r.totalCents, 0);
    const expenseCount = totalExpenseCount;

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
