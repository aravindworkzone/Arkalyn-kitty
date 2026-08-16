import mongoose, { type ClientSession } from 'mongoose';
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

// The stored subscription state. Lives on the Group — accounts have no tier.
interface PlanHolderFields {
    plan?: Plan | null;
    planExpiresAt?: Date | null;
}

// Computes the live entitlement from stored state, accounting for expiry and the
// post-expiry grace window. Done lazily on read so no cron job is needed to
// reset lapsed plans:
//   active : now <= planExpiresAt              -> stored tier, full access
//   grace  : planExpiresAt < now <= +GRACE     -> stored tier, full access
//   expired: now > planExpiresAt + GRACE       -> FREE tier, read-only freeze
export const getEffectivePlan = (holder: PlanHolderFields): EffectivePlan => {
    const storedTier: Plan = holder.plan ?? 'FREE';
    const expiresAt = holder.planExpiresAt ?? null;

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

// The single entitlement lookup: every gate in the app resolves through here.
// A group's plan is its own — bought for it, stored on it — so no membership or
// ownership lookup is involved and the answer is identical for every member.
//
// Closed groups are frozen: they serve the planSnapshot captured at close time
// (treated as non-expiring) so a later purchase or lapse never rewrites the
// historical record.
export const getGroupPlan = async (
    groupId: mongoose.Types.ObjectId | string,
    session?: ClientSession
): Promise<EffectivePlan> => {
    const group = await Group.findById(groupId)
        .select('status plan planExpiresAt planSnapshot')
        .session(session ?? null);

    if (!group) return getEffectivePlan({ plan: 'FREE', planExpiresAt: null });

    if (group.status === 'CLOSED' && group.planSnapshot?.tier) {
        return getEffectivePlan({ plan: group.planSnapshot.tier, planExpiresAt: null });
    }

    return getEffectivePlan({ plan: group.plan, planExpiresAt: group.planExpiresAt });
};

// Counts groups a user owns that are NOT closed — "active" groups. Used by the
// flat MAX_ACTIVE_OWNED_GROUPS anti-abuse cap and by account deletion, which
// refuses to orphan an open group. Not a billing limit: closed groups are frozen
// and don't count either way.
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
