import mongoose from 'mongoose';
import { AppError } from '../helpers/AppError';
import Group from '../models/group.model';
import GroupMember from '../models/group_member.model';
import Category from '../models/category.model';
import Expense from '../models/expense.model';
import GroupEvent from '../models/group_event.model';
import { getGroupOwnerPlan } from '../helpers/planLimits';

const CLOSURE_CATEGORY_NAME = 'Group Closure';
const CLOSURE_CATEGORY_COLOR = '#94a3b8';
const CLOSURE_EXPENSE_TITLE = 'Group closure refund';
const SUM_TOLERANCE_CENTS = 1; // ±0.01

const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (cents: number) => cents / 100;

const rawBalanceCents = (group: any): number => {
    // Bypass the fromDBAmount getter (which rounds) to get raw integer cents.
    const v = group.get('balance', null, { getters: false });
    return typeof v === 'number' ? v : 0;
};

const rawContributionCents = (member: any): number => {
    const v = member.get('contribution', null, { getters: false });
    return typeof v === 'number' ? v : 0;
};

type ActiveMember = {
    userId: mongoose.Types.ObjectId;
    name: string;
    contributionCents: number;
};

const loadActiveMembers = async (groupId: mongoose.Types.ObjectId): Promise<ActiveMember[]> => {
    const members = await GroupMember.find({ groupId, isDeleted: false }).populate('userId', 'name');
    return members.map((m) => ({
        userId: m.userId._id,
        name: (m.userId as any).name ?? '',
        contributionCents: rawContributionCents(m),
    }));
};

const proportionalSplit = (members: ActiveMember[], balanceCents: number): Map<string, number> => {
    const totalContribCents = members.reduce((s, m) => s + m.contributionCents, 0);
    const refunds = new Map<string, number>();

    if (balanceCents <= 0 || members.length === 0) {
        for (const m of members) refunds.set(m.userId.toString(), 0);
        return refunds;
    }

    if (totalContribCents <= 0) {
        // Nobody contributed but balance somehow exists — split equally.
        const each = Math.floor(balanceCents / members.length);
        let remainder = balanceCents - each * members.length;
        for (const m of members) {
            const extra = remainder > 0 ? 1 : 0;
            refunds.set(m.userId.toString(), each + extra);
            if (remainder > 0) remainder -= 1;
        }
        return refunds;
    }

    let allocated = 0;
    for (const m of members) {
        const share = Math.floor((m.contributionCents * balanceCents) / totalContribCents);
        refunds.set(m.userId.toString(), share);
        allocated += share;
    }
    // Distribute the rounding remainder to top contributors so the sum is exact.
    let remainder = balanceCents - allocated;
    const sortedByContrib = [...members].sort((a, b) => b.contributionCents - a.contributionCents);
    let idx = 0;
    while (remainder > 0 && sortedByContrib.length > 0) {
        const m = sortedByContrib[idx % sortedByContrib.length]!;
        const key = m.userId.toString();
        refunds.set(key, (refunds.get(key) ?? 0) + 1);
        remainder -= 1;
        idx += 1;
    }
    return refunds;
};

export const getGroupClosePreviewService = async (groupId: mongoose.Types.ObjectId) => {
    const group = await Group.findById(groupId);
    if (!group) throw new AppError('Group not found', 404);
    if (group.status === 'CLOSED') throw new AppError('Group is already closed', 400);

    const balanceCents = rawBalanceCents(group);
    const members = await loadActiveMembers(groupId);
    const refunds = proportionalSplit(members, balanceCents);
    const totalContribCents = members.reduce((s, m) => s + m.contributionCents, 0);

    return {
        groupId: group._id,
        status: group.status,
        currentBalance: fromCents(balanceCents),
        totalContribution: fromCents(totalContribCents),
        members: members.map((m) => ({
            userId: m.userId,
            name: m.name,
            contribution: fromCents(m.contributionCents),
            proportionalRefund: fromCents(refunds.get(m.userId.toString()) ?? 0),
        })),
    };
};

export const executeGroupCloseService = async (data: {
    groupId: mongoose.Types.ObjectId;
    adminId: mongoose.Types.ObjectId;
    overrides?: { userId: string; refundAmount: number }[];
}) => {
    const { groupId, adminId, overrides } = data;

    // ── Pre-session validation (everything must pass before opening a transaction) ──
    const group = await Group.findById(groupId);
    if (!group) throw new AppError('Group not found', 404);
    if (group.status === 'CLOSED') throw new AppError('Group is already closed', 400);

    const balanceCents = rawBalanceCents(group);
    const members = await loadActiveMembers(groupId);
    if (members.length === 0) {
        throw new AppError('Group has no active members to refund', 400);
    }

    const memberIds = new Set(members.map((m) => m.userId.toString()));

    let refundCentsByUser: Map<string, number>;

    if (overrides && overrides.length > 0) {
        const seen = new Set<string>();
        refundCentsByUser = new Map();
        for (const o of overrides) {
            if (seen.has(o.userId)) {
                throw new AppError(`Duplicate override for user ${o.userId}`, 400);
            }
            seen.add(o.userId);
            if (!memberIds.has(o.userId)) {
                throw new AppError(`User ${o.userId} is not an active member`, 400);
            }
            refundCentsByUser.set(o.userId, toCents(o.refundAmount));
        }
        // Members not in overrides default to 0.
        for (const m of members) {
            const key = m.userId.toString();
            if (!refundCentsByUser.has(key)) refundCentsByUser.set(key, 0);
        }

        const sumCents = Array.from(refundCentsByUser.values()).reduce((s, c) => s + c, 0);
        if (Math.abs(sumCents - balanceCents) > SUM_TOLERANCE_CENTS) {
            throw new AppError(
                `Override refunds (${fromCents(sumCents)}) must sum to current balance (${fromCents(balanceCents)})`,
                400
            );
        }
        // Snap to exact balance if within tolerance.
        if (sumCents !== balanceCents && refundCentsByUser.size > 0) {
            const diff = balanceCents - sumCents;
            const firstKey = refundCentsByUser.keys().next().value as string;
            refundCentsByUser.set(firstKey, (refundCentsByUser.get(firstKey) ?? 0) + diff);
        }
    } else {
        refundCentsByUser = proportionalSplit(members, balanceCents);
    }

    const positiveSplits = members
        .map((m) => ({
            userId: m.userId,
            cents: refundCentsByUser.get(m.userId.toString()) ?? 0,
        }))
        .filter((s) => s.cents > 0);

    const shouldCreateExpense = balanceCents > 0 && positiveSplits.length > 0;

    // ── Session begins only after every business rule passes ──
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        let closingExpenseId: mongoose.Types.ObjectId | undefined;

        if (shouldCreateExpense) {
            let category = await Category.findOne({
                groupId,
                name: CLOSURE_CATEGORY_NAME,
                isDeleted: false,
            }).session(session);

            if (!category) {
                const created = await Category.create(
                    [{ groupId, name: CLOSURE_CATEGORY_NAME, color: CLOSURE_CATEGORY_COLOR }],
                    { session }
                );
                category = created[0]!;
            }

            // Expense model has setters that multiply by 100 — pass dollar values.
            const expenseDoc = new Expense({
                groupId,
                category: category._id,
                title: CLOSURE_EXPENSE_TITLE,
                amount: fromCents(balanceCents),
                splitBetween: positiveSplits.map((s) => ({
                    userId: s.userId,
                    amount: fromCents(s.cents),
                })),
                paidBy: adminId,
                paymentType: 'Cash',
                date: new Date(),
            });
            await expenseDoc.save({ session });
            closingExpenseId = expenseDoc._id as mongoose.Types.ObjectId;
        }

        // Freeze the owner's plan tier onto the group before it closes. The group
        // is still open here, so this resolves the live owner plan; once CLOSED,
        // this snapshot becomes the group's immutable plan record.
        const ownerPlan = await getGroupOwnerPlan(groupId, session);

        const flipped = await Group.findOneAndUpdate(
            { _id: groupId, status: { $ne: 'CLOSED' } },
            { $set: { status: 'CLOSED', balance: 0, planSnapshot: { tier: ownerPlan.tier, snapshotAt: new Date() } } },
            { session, new: true }
        );
        if (!flipped) {
            throw new AppError('Group was closed by another request', 409);
        }

        const closeEvent = new GroupEvent({
            groupId,
            performedBy: adminId,
            eventType: 'GROUP_CLOSED',
            referenceId: closingExpenseId ?? groupId,
            referenceModel: closingExpenseId ? 'Expense' : 'Group',
            amount: fromCents(balanceCents),
            metadata: {
                refundedTotal: fromCents(balanceCents),
                memberCount: members.length,
                overridesApplied: Boolean(overrides && overrides.length > 0),
                refunds: members.map((m) => ({
                    userId: m.userId,
                    name: m.name,
                    refundAmount: fromCents(refundCentsByUser.get(m.userId.toString()) ?? 0),
                })),
                note: `Group closed and ${fromCents(balanceCents)} refunded to members`,
            },
        });
        await closeEvent.save({ session });

        await session.commitTransaction();

        return {
            groupId,
            closingExpenseId,
            refundedTotal: fromCents(balanceCents),
            refunds: members.map((m) => ({
                userId: m.userId,
                name: m.name,
                refundAmount: fromCents(refundCentsByUser.get(m.userId.toString()) ?? 0),
            })),
        };
    } catch (error: any) {
        await session.abortTransaction();
        if (error.name === 'ValidationError') throw new AppError(error.message, 400);
        throw new AppError(error.message || 'Internal server error', error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};
