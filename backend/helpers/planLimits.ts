import mongoose, { type ClientSession } from 'mongoose';
import User from '../models/user.model';
import Group from '../models/group.model';
import GroupMember from '../models/group_member.model';
import { AppError } from './AppError';
import {
    PLANS,
    GRACE_PERIOD_DAYS,
    type Plan,
    type PlanConfig,
    type PlanLimits,
    type PlanFeatures,
} from '../config/constants';

const DAY_MS = 24 * 60 * 60 * 1000;

export type PlanStatus = 'active' | 'grace' | 'expired';

export interface EffectivePlan {
    tier: Plan; // entitlement tier (FREE once a paid plan lapses past grace)
    status: PlanStatus;
    isReadOnly: boolean; // true when downgraded — over-limit writes are frozen
    config: PlanConfig;
    limits: PlanLimits;
    features: PlanFeatures;
    planExpiresAt: Date | null;
}

interface PlanUserFields {
    plan?: Plan | null;
    planExpiresAt?: Date | null;
}

// Computes the live entitlement from stored state, accounting for expiry and the
// post-expiry grace window. Done lazily on read so no cron job is needed to
// reset lapsed plans:
//   active : now <= planExpiresAt              -> stored tier, full access
//   grace  : planExpiresAt < now <= +GRACE     -> stored tier, full access
//   expired: now > planExpiresAt + GRACE       -> FREE tier, read-only freeze
export const getEffectivePlan = (user: PlanUserFields): EffectivePlan => {
    const storedTier: Plan = user.plan ?? 'FREE';
    const expiresAt = user.planExpiresAt ?? null;

    let tier: Plan = storedTier;
    let status: PlanStatus = 'active';
    let isReadOnly = false;

    if (storedTier !== 'FREE' && expiresAt) {
        const now = Date.now();
        const exp = expiresAt.getTime();
        const graceEnd = exp + GRACE_PERIOD_DAYS * DAY_MS;
        if (now <= exp) {
            status = 'active';
        } else if (now <= graceEnd) {
            status = 'grace';
        } else {
            tier = 'FREE';
            status = 'expired';
            isReadOnly = true;
        }
    }

    const config = PLANS[tier];
    return {
        tier,
        status,
        isReadOnly,
        config,
        limits: config.limits,
        features: config.features,
        planExpiresAt: expiresAt,
    };
};

// Resolves a user's effective plan by id.
export const getUserPlan = async (
    userId: mongoose.Types.ObjectId | string,
    session?: ClientSession
): Promise<EffectivePlan> => {
    const user = await User.findById(userId).select('plan planExpiresAt').session(session ?? null);
    return getEffectivePlan({ plan: user?.plan, planExpiresAt: user?.planExpiresAt });
};

// Group-scoped entitlements (members, categories, retention, reports, clone) are
// governed by the group OWNER's plan, since subscriptions are per-account.
//
// Closed groups are frozen: they serve the planSnapshot captured at close time
// (treated as non-expiring) so later upgrades/downgrades by the owner never
// touch the historical record.
export const getGroupOwnerPlan = async (
    groupId: mongoose.Types.ObjectId | string,
    session?: ClientSession
): Promise<EffectivePlan> => {
    const group = await Group.findById(groupId)
        .select('status planSnapshot')
        .session(session ?? null);

    if (group?.status === 'CLOSED' && group.planSnapshot?.tier) {
        return getEffectivePlan({ plan: group.planSnapshot.tier, planExpiresAt: null });
    }

    const owner = await GroupMember.findOne({ groupId, role: 'SUPER_ADMIN', isDeleted: false })
        .select('userId')
        .session(session ?? null);
    if (!owner) return getEffectivePlan({ plan: 'FREE', planExpiresAt: null });
    return getUserPlan(owner.userId, session);
};

// Counts groups a user owns that are NOT closed — "active" groups. Closed groups
// are frozen and don't consume the owner's plan group limit.
export const countActiveOwnedGroups = async (
    userId: mongoose.Types.ObjectId | string,
    session?: ClientSession
): Promise<number> => {
    const ownedGroupIds = await GroupMember.distinct('groupId', {
        userId,
        role: 'SUPER_ADMIN',
        isDeleted: false,
    }).session(session ?? null);
    return Group.countDocuments({ _id: { $in: ownedGroupIds }, status: { $ne: 'CLOSED' } }).session(
        session ?? null
    );
};

// Throws 402 (Payment Required) when a count is at/over a tier limit. `null`
// limit means unlimited.
export const assertWithinLimit = (count: number, limit: number | null, message: string): void => {
    if (limit !== null && count >= limit) {
        throw new AppError(message, 402);
    }
};

// Returns the oldest createdAt a log query should surface, or null for unlimited.
export const retentionFloor = (eff: EffectivePlan, kind: 'event' | 'transaction'): Date | null => {
    const days =
        kind === 'event'
            ? eff.limits.eventLogRetentionDays
            : eff.limits.transactionLogRetentionDays;
    if (days === null) return null;
    return new Date(Date.now() - days * DAY_MS);
};

// Trims an EffectivePlan to the shape sent to the frontend (drops the bulky
// config blob; the limits/features are what the UI gates on).
export const toPlanView = (eff: EffectivePlan) => ({
    tier: eff.tier,
    status: eff.status,
    isReadOnly: eff.isReadOnly,
    planExpiresAt: eff.planExpiresAt,
    limits: eff.limits,
    features: eff.features,
});

// Throws 402 when a premium feature is not available on the effective plan.
export const assertFeature = (
    eff: EffectivePlan,
    feature: keyof PlanFeatures,
    message?: string
): void => {
    if (!eff.features[feature]) {
        throw new AppError(message ?? 'This feature requires a paid plan', 402);
    }
};
