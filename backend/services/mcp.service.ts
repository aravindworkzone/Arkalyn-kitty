import mongoose from 'mongoose';
import GroupMember from '../models/group_member.model';
import Expense from '../models/expense.model';
import Group from '../models/group.model';
import Category from '../models/category.model';
import User from '../models/user.model';
import { AppError } from '../helpers/AppError';
import { getEffectivePlan } from '../helpers/planLimits';

// All MCP services are READ-ONLY and scoped to the calling user. They never take
// a groupId from the client — the set of groups is derived from the user's own
// (non-deleted) memberships, so a key can only ever read its owner's data.

const userGroupIds = (userId: mongoose.Types.ObjectId) =>
    GroupMember.distinct('groupId', { userId, isDeleted: false });

// Escape user-supplied text before it goes into a RegExp so a filter value can't
// inject regex metacharacters.
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface McpExpenseFilters {
    limit: number;
    from?: Date;
    to?: Date;
    group?: string; // matches group name or displayId (case-insensitive substring)
    category?: string; // matches category name (case-insensitive substring)
}

// Balance summary across every group the user belongs to.
export const mcpBalanceService = async (userId: mongoose.Types.ObjectId) => {
    const groups = await GroupMember.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
        { $lookup: { from: 'groups', localField: 'groupId', foreignField: '_id', as: 'group' } },
        { $unwind: '$group' },
        {
            $project: {
                _id: 0,
                groupId: '$group.displayId',
                name: '$group.name',
                status: '$group.status',
                role: '$role',
                // Stored as integer cents — surface in display units.
                balance: { $divide: ['$group.balance', 100] },
            },
        },
        { $sort: { name: 1 } },
    ]);

    const totalBalance = groups.reduce((sum, g) => sum + (g.balance ?? 0), 0);
    return { currency: 'INR', totalBalance, groupCount: groups.length, groups };
};

// Most-recent expenses across all of the user's groups, optionally narrowed by
// date range, group, and/or category so a client can target exactly what it
// needs instead of paging through everything.
export const mcpExpensesService = async (
    userId: mongoose.Types.ObjectId,
    { limit, from, to, group, category }: McpExpenseFilters
) => {
    let groupIds = await userGroupIds(userId);

    // Narrow to the group(s) matching the name or displayId. Resolving up front
    // keeps the expense match scoped to the user's own groups.
    if (group) {
        const rx = new RegExp(escapeRegex(group), 'i');
        groupIds = await Group.find({
            _id: { $in: groupIds },
            $or: [{ name: rx }, { displayId: rx }],
        }).distinct('_id');
    }

    const match: Record<string, unknown> = {
        groupId: { $in: groupIds },
        isDeleted: false,
    };

    // Inclusive date range on the expense date.
    if (from || to) {
        match.date = {
            ...(from ? { $gte: from } : {}),
            ...(to ? { $lte: to } : {}),
        };
    }

    // Resolve category name → ids within the (possibly narrowed) group set, so
    // the filter rides the {groupId, category} index rather than a post-lookup
    // scan. An empty match here naturally yields zero expenses.
    if (category) {
        const rx = new RegExp(escapeRegex(category), 'i');
        match.category = {
            $in: await Category.distinct('_id', {
                groupId: { $in: groupIds },
                name: rx,
                isDeleted: false,
            }),
        };
    }

    const expenses = await Expense.aggregate([
        { $match: match },
        { $sort: { date: -1, createdAt: -1 } },
        { $limit: limit },
        { $lookup: { from: 'groups', localField: 'groupId', foreignField: '_id', as: 'group' } },
        { $unwind: '$group' },
        { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category' } },
        { $lookup: { from: 'users', localField: 'paidBy', foreignField: '_id', as: 'payer' } },
        {
            $project: {
                _id: 0,
                id: { $toString: '$_id' },
                title: '$title',
                amount: { $divide: ['$amount', 100] },
                paymentType: '$paymentType',
                date: '$date',
                group: '$group.name',
                category: { $ifNull: [{ $first: '$category.name' }, null] },
                paidBy: { $ifNull: [{ $first: '$payer.name' }, 'Deleted user'] },
            },
        },
    ]);

    return {
        currency: 'INR',
        count: expenses.length,
        // Echo what was actually applied so the caller can confirm the filter.
        filters: {
            from: from ?? null,
            to: to ?? null,
            group: group ?? null,
            category: category ?? null,
        },
        expenses,
    };
};

// Every member across all of the user's groups.
export const mcpMembersService = async (userId: mongoose.Types.ObjectId) => {
    const groupIds = await userGroupIds(userId);

    const members = await GroupMember.aggregate([
        { $match: { groupId: { $in: groupIds }, isDeleted: false } },
        { $lookup: { from: 'groups', localField: 'groupId', foreignField: '_id', as: 'group' } },
        { $unwind: '$group' },
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
        {
            $project: {
                _id: 0,
                group: '$group.name',
                groupId: '$group.displayId',
                name: { $ifNull: [{ $first: '$user.name' }, 'Deleted user'] },
                role: '$role',
                contribution: { $divide: ['$contribution', 100] },
            },
        },
        { $sort: { group: 1, role: 1 } },
    ]);

    return { currency: 'INR', count: members.length, members };
};

// The user's effective subscription tier + renewal date.
export const mcpSubscriptionService = async (userId: mongoose.Types.ObjectId) => {
    const user = await User.findById(userId).select('plan planExpiresAt');
    if (!user) throw new AppError('User not found', 404);

    const eff = getEffectivePlan({ plan: user.plan, planExpiresAt: user.planExpiresAt });
    return {
        tier: eff.tier,
        planName: eff.config.name,
        status: eff.status, // active | grace | expired
        renewalDate: eff.planExpiresAt, // null on FREE (no renewal)
        isReadOnly: eff.isReadOnly,
    };
};
