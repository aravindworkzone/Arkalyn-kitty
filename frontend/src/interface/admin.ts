import type { PlanTier, BillingCycle, PlanStatus } from './subscription';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type UserRole = 'USER' | 'APP_OWNER';
export type PlanSource = 'PAYMENT' | 'PROMO' | 'ADMIN' | null;

// Accounts carry no tier — subscriptions hang off groups, so plan columns live
// on AdminGroupSubscriptionRow instead.
export interface AdminUserRow {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    createdAt: string;
    lastLoginAt: string | null;
}

export interface AdminUserDetail {
    user: AdminUserRow;
    // Each group reports its OWN effective tier, which is where entitlement lives.
    groups: Array<{
        _id: string;
        displayId: string;
        name: string;
        status: string;
        role: string;
        planTier: PlanTier;
        lastActionAt: string | null;
    }>;
}

// One row of the group-subscription table — the unit that actually holds a plan.
export interface AdminGroupSubscriptionRow {
    _id: string;
    name: string;
    displayId: string;
    status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
    plan: PlanTier;
    effectiveTier: PlanTier;
    planStatus: PlanStatus;
    planExpiresAt: string | null;
    planCycle: BillingCycle | null;
    planSource: PlanSource;
    createdAt: string;
}

export interface PromoCode {
    _id: string;
    code: string;
    plan: PlanTier;
    cycle: BillingCycle;
    periodDays: number;
    maxRedemptions: number | null;
    redemptionCount: number;
    expiresAt: string | null;
    isActive: boolean;
    createdAt: string;
}

export interface PromoRedemption {
    _id: string;
    code: string;
    plan: PlanTier;
    periodDays: number;
    createdAt: string;
    userId: { _id: string; name: string; email: string } | string;
    // The group the code was spent on — codes are one-per-group.
    groupId: { _id: string; name: string; displayId: string } | string | null;
}

export interface Analytics {
    totalUsers: number;
    suspendedUsers: number;
    activeGroups: number;
    // Counts GROUPS per effective tier.
    planBreakdown: Record<PlanTier, number>;
    payingGroups: number;
    revenue: { mrr: number; totalRevenue: number; currency: string };
    signups: Array<{ period: string; count: number }>;
    granularity: 'day' | 'week' | 'month';
}

export interface CapturedLog {
    level: number;
    levelLabel: string;
    time: number;
    msg?: string;
    err?: unknown;
}

export interface SystemHealth {
    server: { status: string; uptimeSec: number; memoryMB: number; timestamp: string };
    db: { status: string; connected: boolean; responseMs: number | null };
    recentLogs: CapturedLog[];
}
