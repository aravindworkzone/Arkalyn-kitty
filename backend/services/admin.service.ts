import mongoose from 'mongoose';
import User from '../models/user.model';
import Group from '../models/group.model';
import GroupMember from '../models/group_member.model';
import GroupInvite from '../models/group_invite.model';
import GroupEvent from '../models/group_event.model';
import GroupTransaction from '../models/group_transaction.model';
import Expense from '../models/expense.model';
import Category from '../models/category.model';
import Notification from '../models/notification.model';
import PasswordReset from '../models/password_reset.model';
import SubscriptionPayment from '../models/subscription_payment.model';
import Session from '../models/session.model';
import PromoCode from '../models/promo_code.model';
import PromoRedemption from '../models/promo_redemption.model';
import { AppError } from '../helpers/AppError';
import { getEffectivePlan, toPlanView } from '../helpers/planLimits';
import { userGroupsService } from './user.service';
import { createNotification } from './notification.service';
import { emitToUser } from '../sockets';
import { SOCKET_EVENTS } from '../sockets/events';
import { getSystemHealthSnapshot } from '../utils/health';
import {
    PLANS,
    BILLING_PERIOD_DAYS,
    GRACE_PERIOD_DAYS,
    type Plan,
    type BillingCycle,
} from '../config/constants';

const DAY_MS = 24 * 60 * 60 * 1000;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Users ──────────────────────────────────────────────────────────────────

export const listUsersService = async (
    page: number,
    limit: number,
    opts: { search?: string; status?: string; plan?: string; sort?: 'newest' | 'oldest' } = {}
) => {
    const filter: Record<string, unknown> = {};
    if (opts.search && opts.search.trim()) {
        const rx = new RegExp(escapeRegex(opts.search.trim()), 'i');
        filter.$or = [{ name: rx }, { email: rx }];
    }
    if (opts.status) filter.status = opts.status;
    if (opts.plan) filter.plan = opts.plan;

    const sortDir = opts.sort === 'oldest' ? 1 : -1;

    const [docs, total] = await Promise.all([
        User.find(filter)
            .select('_id name email role status plan planExpiresAt planSource createdAt')
            .sort({ createdAt: sortDir })
            .skip((page - 1) * limit)
            .limit(limit),
        User.countDocuments(filter),
    ]);

    const items = docs.map((u) => {
        const eff = getEffectivePlan({ plan: u.plan, planExpiresAt: u.planExpiresAt });
        return {
            _id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            plan: u.plan,
            effectiveTier: eff.tier,
            planSource: u.planSource,
            createdAt: u.createdAt,
        };
    });

    return { items, total };
};

export const getUserDetailService = async (userId: string) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new AppError('Invalid user ID', 400);
    const user = await User.findById(userId).select(
        '_id name email role status plan planExpiresAt planCycle planSource createdAt'
    );
    if (!user) throw new AppError('User not found', 404);

    const groups = await userGroupsService(user._id as mongoose.Types.ObjectId);

    // "Last action" per group = most recent activity across its audit log
    // (member/category/role/close events) and its transactions (contributions,
    // expenses, refunds). Computed in two grouped aggregations, then merged.
    const groupIds = groups.map((g) => g._id as mongoose.Types.ObjectId);
    const [evtAgg, txAgg] = await Promise.all([
        GroupEvent.aggregate<{ _id: mongoose.Types.ObjectId; at: Date }>([
            { $match: { groupId: { $in: groupIds } } },
            { $group: { _id: '$groupId', at: { $max: '$createdAt' } } },
        ]),
        GroupTransaction.aggregate<{ _id: mongoose.Types.ObjectId; at: Date }>([
            { $match: { groupId: { $in: groupIds } } },
            { $group: { _id: '$groupId', at: { $max: '$createdAt' } } },
        ]),
    ]);

    const lastActionMap = new Map<string, Date>();
    for (const row of [...evtAgg, ...txAgg]) {
        const key = String(row._id);
        const current = lastActionMap.get(key);
        if (!current || row.at > current) lastActionMap.set(key, row.at);
    }

    const groupsWithAction = groups.map((g) => ({
        ...g,
        lastActionAt: lastActionMap.get(String(g._id)) ?? null,
    }));

    const subscription = toPlanView(getEffectivePlan({ plan: user.plan, planExpiresAt: user.planExpiresAt }));

    return {
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            plan: user.plan,
            planExpiresAt: user.planExpiresAt,
            planCycle: user.planCycle,
            planSource: user.planSource,
            createdAt: user.createdAt,
            subscription,
        },
        groups: groupsWithAction,
    };
};

// Suspends/restores/soft-deletes. Owners are protected; suspend & delete revoke
// all sessions and force an immediate logout over the socket.
const setUserStatus = async (
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new AppError('Invalid user ID', 400);
    const user = await User.findById(userId).select('role status');
    if (!user) throw new AppError('User not found', 404);
    if (user.role === 'APP_OWNER') throw new AppError('Cannot change the status of an owner account', 403);

    user.status = status;
    await user.save();

    if (status !== 'ACTIVE') {
        await Session.deleteMany({ userId: user._id });
        emitToUser(String(user._id), SOCKET_EVENTS.FORCE_LOGOUT, { reason: status });
    }

    return { _id: user._id, status: user.status };
};

export const suspendUserService = (userId: string) => setUserStatus(userId, 'SUSPENDED');
export const restoreUserService = (userId: string) => setUserStatus(userId, 'ACTIVE');
export const deleteUserService = (userId: string) => setUserStatus(userId, 'DELETED');

// Permanent, irreversible removal of an account and its personal data. Unlike a
// status flip, this runs a full pre-delete handover so no group is orphaned:
//   • groups where the user was the SOLE member are deleted (with cascade),
//   • groups the user OWNED (SUPER_ADMIN) are handed to the earliest-joined
//     ADMIN, or the earliest-joined MEMBER when there is no admin,
//   • the user's membership is then removed from every surviving group.
// Financial history is preserved: expenses stay untouched and contribution
// credits live on in GroupTransaction (rendered against a "Deleted user"), so
// pool balances remain auditable. All group mutations and the account purge run
// in a single transaction; promoted members are notified only after it commits.
export const hardDeleteUserService = async (
    userId: string,
    actorId: mongoose.Types.ObjectId | string
) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new AppError('Invalid user ID', 400);
    const user = await User.findById(userId).select('role');
    if (!user) throw new AppError('User not found', 404);
    if (user.role === 'APP_OWNER') throw new AppError('Cannot delete an owner account', 403);

    const uid = user._id as mongoose.Types.ObjectId;

    // Collected during the transaction, fired as notifications only after commit —
    // a rolled-back delete must never produce a phantom "you were promoted" alert.
    const promotions: { groupId: mongoose.Types.ObjectId; promotedUserId: mongoose.Types.ObjectId }[] = [];
    let groupsDeleted = 0;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // ── Pre-delete handover, one group at a time ────────────────────────
        // A session/transaction runs operations sequentially — no Promise.all
        // (it throws "does not match any in-progress transactions").
        const memberships = await GroupMember.find({ userId: uid, isDeleted: false })
            .select('groupId role')
            .session(session);

        for (const membership of memberships) {
            const groupId = membership.groupId;

            const otherMembers = await GroupMember.find({
                groupId,
                userId: { $ne: uid },
                isDeleted: false,
            })
                .select('userId role createdAt')
                .sort({ createdAt: 1 })
                .session(session);

            // (a) Sole member → the group has no reason to survive. Cascade-delete
            // its data, mirroring group.model's findOneAndDelete hook (which does
            // NOT fire for the session-scoped deleteOne used here).
            if (otherMembers.length === 0) {
                await Expense.deleteMany({ groupId }, { session });
                await Category.deleteMany({ groupId }, { session });
                await GroupMember.deleteMany({ groupId }, { session });
                await GroupEvent.updateMany({ groupId }, { $set: { isDeleted: true } }, { session });
                await GroupTransaction.updateMany({ groupId }, { $set: { isDeleted: true } }, { session });
                await Group.deleteOne({ _id: groupId }, { session });
                groupsDeleted += 1;
                continue;
            }

            // (b) Owner of a group with survivors → hand ownership over. Members
            // come back sorted by join time, so the first ADMIN (else first
            // MEMBER) is the earliest-joined heir.
            if (membership.role === 'SUPER_ADMIN') {
                const heir =
                    otherMembers.find((m) => m.role === 'ADMIN') ??
                    otherMembers.find((m) => m.role === 'MEMBER') ??
                    otherMembers[0];

                await GroupMember.updateOne(
                    { groupId, userId: heir.userId, isDeleted: false },
                    { $set: { role: 'SUPER_ADMIN' } },
                    { session }
                );

                await GroupEvent.create(
                    [{
                        groupId,
                        performedBy: actorId,
                        eventType: 'CHANGE_ROLE',
                        referenceId: heir.userId,
                        referenceModel: 'User',
                        metadata: {
                            note: 'Promoted to super admin after the previous owner account was deleted',
                            previousOwner: String(uid),
                            newRole: 'SUPER_ADMIN',
                        },
                    }],
                    { session }
                );

                promotions.push({ groupId, promotedUserId: heir.userId as mongoose.Types.ObjectId });
            }

            // (c) Remove the user from the surviving group. The membership row is
            // hard-removed; contribution credits remain in GroupTransaction (shown
            // against a "Deleted user"), preserving pool-balance accuracy.
            await GroupMember.deleteOne({ groupId, userId: uid }, { session });
            await GroupEvent.create(
                [{
                    groupId,
                    performedBy: actorId,
                    eventType: 'MEMBER_REMOVED',
                    referenceId: uid,
                    referenceModel: 'User',
                    metadata: { note: 'Member removed — account permanently deleted' },
                }],
                { session }
            );
        }

        // ── Purge account-scoped data + the user document ───────────────────
        await Session.deleteMany({ userId: uid }, { session });
        await PasswordReset.deleteMany({ userId: uid }, { session });
        await PromoRedemption.deleteMany({ userId: uid }, { session });
        await SubscriptionPayment.deleteMany({ userId: uid }, { session });
        // Sweep any leftover memberships (e.g. previously soft-deleted rows not
        // touched by the handover loop above).
        await GroupMember.deleteMany({ userId: uid }, { session });
        await GroupInvite.deleteMany({ $or: [{ invitedUser: uid }, { invitedBy: uid }] }, { session });
        await Notification.deleteMany({ $or: [{ recipient: uid }, { actor: uid }] }, { session });
        await User.deleteOne({ _id: uid }, { session });

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }

    // Post-commit side effects (non-transactional by design): notify each heir and
    // bounce any live socket for the deleted account.
    for (const { groupId, promotedUserId } of promotions) {
        await createNotification({
            recipient: promotedUserId,
            actor: actorId,
            group: groupId,
            type: 'ROLE_CHANGED',
            metadata: { note: 'You are now the super admin of this group.', newRole: 'SUPER_ADMIN' },
        });
    }
    emitToUser(String(uid), SOCKET_EVENTS.FORCE_LOGOUT, { reason: 'DELETED' });

    return {
        _id: uid,
        hardDeleted: true,
        groupsDeleted,
        ownershipsTransferred: promotions.length,
    };
};

// ── Manual plan override ─────────────────────────────────────────────────────

export const overridePlanService = async (
    userId: string,
    plan: Plan,
    cycle: BillingCycle | undefined,
    expiresAt: string | undefined
) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new AppError('Invalid user ID', 400);
    const user = await User.findById(userId).select('plan planExpiresAt planCycle planSource');
    if (!user) throw new AppError('User not found', 404);

    if (plan === 'FREE') {
        user.plan = 'FREE';
        user.planExpiresAt = null;
        user.planCycle = null;
        user.planSource = null;
    } else {
        const days = BILLING_PERIOD_DAYS[cycle ?? 'monthly'];
        user.plan = plan;
        user.planExpiresAt = expiresAt ? new Date(expiresAt) : new Date(Date.now() + days * 86400000);
        user.planCycle = cycle ?? 'monthly';
        user.planSource = 'ADMIN';
    }
    await user.save();

    return toPlanView(getEffectivePlan({ plan: user.plan, planExpiresAt: user.planExpiresAt }));
};

// ── Promo codes ──────────────────────────────────────────────────────────────

export const createPromoService = async (data: {
    code: string;
    plan: Exclude<Plan, 'FREE'>;
    cycle: BillingCycle;
    maxRedemptions: number | null;
    expiresAt?: string;
}) => {
    try {
        const promo = await PromoCode.create({
            code: data.code.trim().toUpperCase(),
            plan: data.plan,
            cycle: data.cycle,
            periodDays: BILLING_PERIOD_DAYS[data.cycle],
            maxRedemptions: data.maxRedemptions,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            isActive: true,
        });
        return promo;
    } catch (e: any) {
        if (e.code === 11000) throw new AppError('A promo code with that code already exists', 409);
        throw e;
    }
};

export const listPromosService = async () => PromoCode.find().sort({ createdAt: -1 });

export const deactivatePromoService = async (id: string) => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid promo ID', 400);
    const promo = await PromoCode.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!promo) throw new AppError('Promo code not found', 404);
    return promo;
};

export const getPromoRedemptionsService = async (id: string) => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid promo ID', 400);
    return PromoRedemption.find({ promoCodeId: id })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 });
};

// ── Analytics / subscription overview ────────────────────────────────────────

const monthlyEquivalent = (plan: Plan, cycle: BillingCycle | null): number => {
    if (plan === 'FREE') return 0;
    const cfg = PLANS[plan];
    return cycle === 'yearly' ? Math.round(cfg.priceYearly / 12) : cfg.priceMonthly;
};

// Subscription/plan rollup for the dashboard. Built to stay flat as the user
// table grows: instead of loading every user into memory, the database buckets
// each account by its (stored plan, cycle, source, status) and the live
// entitlement window (active / grace / expired) — mirroring getEffectivePlan —
// then counts them. Node receives only a few dozen grouped rows regardless of
// whether there are 10 users or 10 million. The tiny pricing math then reuses
// the SAME monthlyEquivalent + effective-tier rules, so MRR can't drift from the
// per-user computation used elsewhere.
type PlanBucketRow = {
    _id: {
        plan: Plan | null;
        cycle: BillingCycle | null;
        source: string | null;
        status: string;
        window: 'active' | 'grace' | 'expired';
    };
    count: number;
};

export const getAnalyticsService = async (granularity: 'day' | 'week' | 'month') => {
    const now = new Date();
    const graceMs = GRACE_PERIOD_DAYS * DAY_MS;

    const [planRows, activeGroups, signups] = await Promise.all([
        User.aggregate<PlanBucketRow>([
            { $match: { status: { $ne: 'DELETED' } } },
            { $addFields: { _stored: { $ifNull: ['$plan', 'FREE'] } } },
            {
                $addFields: {
                    // Entitlement window — identical branching to getEffectivePlan:
                    // FREE or no expiry is always "active"; otherwise compare now
                    // against expiry and the grace cutoff.
                    _window: {
                        $cond: [
                            {
                                $or: [
                                    { $eq: ['$_stored', 'FREE'] },
                                    { $eq: [{ $ifNull: ['$planExpiresAt', null] }, null] },
                                ],
                            },
                            'active',
                            {
                                $let: {
                                    vars: { graceEnd: { $add: ['$planExpiresAt', graceMs] } },
                                    in: {
                                        $switch: {
                                            branches: [
                                                { case: { $lte: [now, '$planExpiresAt'] }, then: 'active' },
                                                { case: { $lte: [now, '$$graceEnd'] }, then: 'grace' },
                                            ],
                                            default: 'expired',
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: {
                        plan: '$_stored',
                        cycle: '$planCycle',
                        source: '$planSource',
                        status: '$status',
                        window: '$_window',
                    },
                    count: { $sum: 1 },
                },
            },
        ]),
        Group.countDocuments({ status: { $ne: 'CLOSED' } }),
        User.aggregate([
            { $match: { status: { $ne: 'DELETED' } } },
            { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: granularity } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, period: '$_id', count: 1 } },
        ]),
    ]);

    const planBreakdown: Record<Plan, number> = { FREE: 0, PRO: 0, PREMIUM: 0 };
    let totalUsers = 0;
    let suspended = 0;
    let mrr = 0;

    for (const row of planRows) {
        const { plan, cycle, source, status, window } = row._id;
        const c = row.count;
        totalUsers += c;
        if (status === 'SUSPENDED') suspended += c;

        // Effective tier: an expired paid plan collapses to FREE (same as
        // getEffectivePlan); active/grace keep the stored tier.
        const effTier: Plan = window === 'expired' ? 'FREE' : (plan ?? 'FREE');
        planBreakdown[effTier] += c;

        // Revenue counts only actively-paid seats (not promo/admin comps, not in
        // grace, not expired) — matches the per-user MRR rule exactly.
        if (effTier !== 'FREE' && window === 'active' && source === 'PAYMENT') {
            mrr += monthlyEquivalent(effTier, cycle) * c;
        }
    }

    return {
        totalUsers,
        suspendedUsers: suspended,
        activeGroups,
        planBreakdown,
        revenue: { mrr, arr: mrr * 12, currency: 'INR' },
        signups,
        granularity,
    };
};

// ── System health ────────────────────────────────────────────────────────────

export const getHealthService = (minLogLevel?: number) =>
    getSystemHealthSnapshot({ ping: true, minLogLevel });
