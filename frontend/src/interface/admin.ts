import type { PlanTier, BillingCycle, PlanView } from './subscription';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type UserRole = 'USER' | 'APP_OWNER';
export type PlanSource = 'PAYMENT' | 'PROMO' | 'ADMIN' | null;

export interface AdminUserRow {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    plan: PlanTier;
    effectiveTier: PlanTier;
    planSource: PlanSource;
    createdAt: string;
}

export interface AdminUserDetail {
    user: AdminUserRow & {
        planExpiresAt: string | null;
        planCycle: BillingCycle | null;
        subscription: PlanView;
    };
    groups: Array<{ _id: string; displayId: string; name: string; status: string; role: string; lastActionAt: string | null }>;
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
}

export interface Analytics {
    totalUsers: number;
    suspendedUsers: number;
    activeGroups: number;
    planBreakdown: Record<PlanTier, number>;
    revenue: { mrr: number; arr: number; currency: string };
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
