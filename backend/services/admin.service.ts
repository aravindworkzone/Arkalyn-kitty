import mongoose from 'mongoose';
import User from '../models/user.model';
import Group from '../models/group.model';
import GroupMember from '../models/group_member.model';
import GroupInvite from '../models/group_invite.model';
import GroupEvent from '../models/group_event.model';
import GroupTransaction from '../models/group_transaction.model';
import Notification from '../models/notification.model';
import PasswordReset from '../models/password_reset.model';
import SubscriptionPayment from '../models/subscription_payment.model';
import Session from '../models/session.model';
import PromoCode from '../models/promo_code.model';
import PromoRedemption from '../models/promo_redemption.model';
import { AppError } from '../helpers/AppError';
import { getEffectivePlan, toPlanView, countActiveOwnedGroups } from '../helpers/planLimits';
import { userGroupsService } from './user.service';
import { emitToUser } from '../sockets';
import { SOCKET_EVENTS } from '../sockets/events';
import { getSystemHealthSnapshot } from '../utils/health';
import {
    PLANS,
    BILLING_PERIOD_DAYS,
    type Plan,
    type BillingCycle,
} from '../config/constants';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Users ──────────────────────────────────────────────────────────────────

export const listUsersService = async (page: number, limit: number, search?: string) => {
    const filter: Record<string, unknown> = {};
    if (search && search.trim()) {
        const rx = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ name: rx }, { email: rx }];
    }

    const [docs, total] = await Promise.all([
        User.find(filter)
            .select('_id name email role status plan planExpiresAt planSource createdAt')
            .sort({ createdAt: -1 })
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

// Permanent, irreversible removal of an account and its personal data. Group
// financial history (expenses/transactions/events) is preserved as an audit
// record; only the account, its memberships, and account-scoped data are purged.
// Blocked while the user still owns any non-closed group, to protect those
// groups' integrity (they must be closed/handed over first).
export const hardDeleteUserService = async (userId: string) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new AppError('Invalid user ID', 400);
    const user = await User.findById(userId).select('role');
    if (!user) throw new AppError('User not found', 404);
    if (user.role === 'APP_OWNER') throw new AppError('Cannot delete an owner account', 403);

    const ownedActive = await countActiveOwnedGroups(user._id as mongoose.Types.ObjectId);
    if (ownedActive > 0) {
        throw new AppError(
            'This user owns active groups. Close (or hand over) those groups before deleting the account.',
            409
        );
    }

    const uid = user._id as mongoose.Types.ObjectId;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        // A session/transaction can't run operations concurrently — these must be
        // sequential (Promise.all here throws "does not match any in-progress
        // transactions").
        await Session.deleteMany({ userId: uid }, { session });
        await PasswordReset.deleteMany({ userId: uid }, { session });
        await PromoRedemption.deleteMany({ userId: uid }, { session });
        await SubscriptionPayment.deleteMany({ userId: uid }, { session });
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

    // Sessions are already gone; this just bounces any live socket immediately.
    emitToUser(String(uid), SOCKET_EVENTS.FORCE_LOGOUT, { reason: 'DELETED' });

    return { _id: uid, hardDeleted: true };
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

export const getAnalyticsService = async (granularity: 'day' | 'week' | 'month') => {
    const [users, activeGroups, signups] = await Promise.all([
        User.find({ status: { $ne: 'DELETED' } }).select('plan planExpiresAt planCycle planSource status'),
        Group.countDocuments({ status: { $ne: 'CLOSED' } }),
        User.aggregate([
            { $match: { status: { $ne: 'DELETED' } } },
            { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: granularity } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, period: '$_id', count: 1 } },
        ]),
    ]);

    const planBreakdown: Record<Plan, number> = { FREE: 0, PRO: 0, PREMIUM: 0 };
    let mrr = 0;
    let suspended = 0;

    for (const u of users) {
        if (u.status === 'SUSPENDED') suspended += 1;
        const eff = getEffectivePlan({ plan: u.plan, planExpiresAt: u.planExpiresAt });
        planBreakdown[eff.tier] += 1;
        // Revenue counts only actively-paid (not promo/admin comps, not expired).
        if (eff.tier !== 'FREE' && eff.status === 'active' && u.planSource === 'PAYMENT') {
            mrr += monthlyEquivalent(eff.tier, u.planCycle);
        }
    }

    return {
        totalUsers: users.length,
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
