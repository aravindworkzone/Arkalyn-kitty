import mongoose from 'mongoose';
import GroupMember, { type IGroupMember } from '../models/group_member.model';
import Expense, { PAYMENT_TYPES, type PaymentType } from '../models/expense.model';
import Group, { type IGroup } from '../models/group.model';
import Category from '../models/category.model';
import User from '../models/user.model';
import { AppError } from '../helpers/AppError';
import { getEffectivePlan } from '../helpers/planLimits';
import { createExpenseService } from './expense.service';
import { createCategoryService } from './category.service';
import { addContributionService } from './group.service';

// MCP services are scoped to the calling user. They never take a raw groupId
// from the client — every group is resolved from the user's own (non-deleted)
// memberships, so a key can only ever read or write its owner's data. The write
// services additionally re-check group status and role, mirroring the same
// guards the web routes apply, and delegate to the shared create services so
// balance math, audit logs, and plan limits stay identical across both paths.

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

// ---------------------------------------------------------------------------
// Write services — each resolves the target group from the user's memberships,
// enforces the same status/role guards as the equivalent web route, then hands
// off to the shared create service.
// ---------------------------------------------------------------------------

type GroupRole = IGroupMember['role'];

// Resolves a user-supplied group reference (name or displayId) to one of the
// caller's own groups, applying the active-status and (optional) role checks the
// web middleware would. Ambiguous references fail loudly rather than guessing.
const resolveGroupForWrite = async (
    userId: mongoose.Types.ObjectId,
    groupRef: string,
    roles?: GroupRole[]
): Promise<{ group: IGroup; member: IGroupMember }> => {
    const ref = (groupRef ?? '').trim();
    if (!ref) throw new AppError('A group name or ID is required', 400);

    const groupIds = await userGroupIds(userId);

    // Prefer an exact (case-insensitive) name/displayId match; fall back to a
    // substring match only if nothing matched exactly.
    const exact = new RegExp(`^${escapeRegex(ref)}$`, 'i');
    let matches = await Group.find({ _id: { $in: groupIds }, $or: [{ name: exact }, { displayId: exact }] });
    if (matches.length === 0) {
        const sub = new RegExp(escapeRegex(ref), 'i');
        matches = await Group.find({ _id: { $in: groupIds }, $or: [{ name: sub }, { displayId: sub }] });
    }

    if (matches.length === 0) throw new AppError(`No group of yours matches "${ref}"`, 404);
    if (matches.length > 1) {
        const ids = matches.map((g) => g.displayId).join(', ');
        throw new AppError(`"${ref}" matches multiple groups (${ids}). Use the group ID.`, 400);
    }

    const group = matches[0];
    if (group.status === 'CLOSED') {
        throw new AppError('Group is closed — no further changes are allowed', 403);
    }

    const member = await GroupMember.findOne({ groupId: group._id, userId, isDeleted: false });
    if (!member) throw new AppError('You are not a member of this group', 403);
    if (roles && !roles.includes(member.role)) {
        throw new AppError(`This action requires ${roles.join(' or ')} in the group`, 403);
    }

    return { group, member };
};

// Resolves a member reference (name or email) to a userId within the group.
const resolveMember = async (groupId: mongoose.Types.ObjectId, ref: string): Promise<mongoose.Types.ObjectId> => {
    const r = ref.trim().toLowerCase();
    const members = await GroupMember.aggregate<{ userId: mongoose.Types.ObjectId; name?: string; email?: string }>([
        { $match: { groupId, isDeleted: false } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { _id: 0, userId: '$userId', name: '$user.name', email: '$user.email' } },
    ]);

    const exact = members.filter((m) => m.name?.toLowerCase() === r || m.email?.toLowerCase() === r);
    const pool = exact.length ? exact : members.filter((m) => m.name?.toLowerCase().includes(r));

    if (pool.length === 0) throw new AppError(`No member matching "${ref}" in this group`, 404);
    if (pool.length > 1) throw new AppError(`"${ref}" matches multiple members. Be more specific.`, 400);
    return pool[0].userId;
};

export interface McpAddExpenseInput {
    group: string;
    title: string;
    amount: number;
    category: string;
    paymentType?: string;
    date?: string;
    paidBy?: string;
}

// Adds an expense to one of the caller's groups. Any member may add an expense
// (matching the web route, which has no role gate), but the group must be active
// and the category must already exist.
export const mcpAddExpenseService = async (userId: mongoose.Types.ObjectId, input: McpAddExpenseInput) => {
    const { group } = await resolveGroupForWrite(userId, input.group);

    // Resolve category by name within this group (exact first, then substring).
    const catRef = (input.category ?? '').trim();
    if (!catRef) throw new AppError('A category name is required', 400);
    const exactCat = new RegExp(`^${escapeRegex(catRef)}$`, 'i');
    let category = await Category.findOne({ groupId: group._id, type: { $ne: 'CREDIT' }, name: exactCat, isDeleted: false });
    if (!category) {
        const subCat = new RegExp(escapeRegex(catRef), 'i');
        const cats = await Category.find({ groupId: group._id, type: { $ne: 'CREDIT' }, name: subCat, isDeleted: false });
        if (cats.length === 1) category = cats[0];
        else if (cats.length > 1) throw new AppError(`"${catRef}" matches multiple categories. Be more specific.`, 400);
    }
    if (!category) throw new AppError(`Category "${catRef}" not found in this group — add it first.`, 404);

    // Who paid: defaults to the key owner; an optional name/email picks another member.
    const paidBy = input.paidBy?.trim() ? await resolveMember(group._id, input.paidBy) : userId;

    const paymentType = (input.paymentType?.trim() || 'Cash') as PaymentType;
    if (!PAYMENT_TYPES.includes(paymentType)) {
        throw new AppError(`Invalid payment type. Use one of: ${PAYMENT_TYPES.join(', ')}`, 400);
    }

    const date = input.date ? new Date(input.date) : new Date();
    if (Number.isNaN(date.getTime())) throw new AppError('Invalid date — use ISO 8601 (e.g. 2026-06-17)', 400);

    const expense = await createExpenseService({
        user: userId.toString(),
        group: { _id: group._id.toString(), balance: group.balance },
        category: category._id.toString(),
        title: input.title,
        amount: input.amount,
        paymentType,
        paidBy: paidBy.toString(),
        date,
    });

    return {
        id: expense._id.toString(),
        title: expense.title,
        amount: expense.amount, // getter returns display units
        currency: 'INR',
        category: category.name,
        paymentType,
        date: expense.date,
        group: group.name,
    };
};

export interface McpAddCategoryInput {
    group: string;
    name: string;
    color?: string;
}

// Adds a category to one of the caller's groups (admins only).
export const mcpAddCategoryService = async (userId: mongoose.Types.ObjectId, input: McpAddCategoryInput) => {
    const { group } = await resolveGroupForWrite(userId, input.group, ['SUPER_ADMIN', 'ADMIN']);

    const { category } = await createCategoryService({
        name: input.name,
        groupId: group._id as mongoose.Types.ObjectId,
        userId,
        color: input.color?.trim() || undefined,
    });

    return {
        id: category._id.toString(),
        name: category.name,
        color: category.color,
        group: group.name,
    };
};

export interface McpAddContributionInput {
    group: string;
    amount: number;
    member?: string;
    description?: string;
}

// Credits a contribution into one of the caller's groups (admins only). Defaults
// to crediting the caller; an optional member name/email targets someone else.
export const mcpAddContributionService = async (userId: mongoose.Types.ObjectId, input: McpAddContributionInput) => {
    const { group } = await resolveGroupForWrite(userId, input.group, ['SUPER_ADMIN', 'ADMIN']);

    const targetId = input.member?.trim() ? await resolveMember(group._id, input.member) : userId;

    await addContributionService({
        group: group._id as mongoose.Types.ObjectId,
        userId: targetId,
        contribution: input.amount,
        description: input.description?.trim() ?? '',
    });

    const [target, fresh] = await Promise.all([
        User.findById(targetId).select('name'),
        Group.findById(group._id).select('balance'),
    ]);

    return {
        group: group.name,
        member: target?.name ?? 'Unknown',
        amount: input.amount,
        currency: 'INR',
        newGroupBalance: fresh?.balance ?? null,
    };
};
