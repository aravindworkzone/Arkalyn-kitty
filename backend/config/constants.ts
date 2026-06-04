export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

export const MAX_ACTIVE_SESSIONS = 3;

export const BCRYPT_SALT_ROUNDS = 10;

// How long a password-reset link stays valid.
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export const REQUEST_BODY_LIMIT = '1mb';

export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
} as const;

export const RATE_LIMIT = {
    AUTH_WINDOW_MS: 15 * 60 * 1000,
    AUTH_MAX_ATTEMPTS: 15,
    GLOBAL_WINDOW_MS: 15 * 60 * 1000,
    GLOBAL_MAX_REQUESTS: 300,
    // Contact form is public + sends email — keep it tight to deter spam/abuse.
    CONTACT_WINDOW_MS: 60 * 60 * 1000,
    CONTACT_MAX_REQUESTS: 5,
} as const;

export const DB_RETRY = {
    MAX_ATTEMPTS: 5,
    INITIAL_DELAY_MS: 1000,
    MAX_DELAY_MS: 30_000,
} as const;

export const ROLES = {
    ADMIN: 'admin',
    MEMBER: 'member',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ---------------------------------------------------------------------------
// Subscription plans (SaaS tiers)
// ---------------------------------------------------------------------------
// Single source of truth for tier entitlements. Served to the frontend via
// GET /api/subscription/plans so the UI never drifts from the backend.
// `null` on a limit means "unlimited". Prices are in whole rupees (INR);
// `priceYearly` is the full amount charged for a year (not per-month).

// App-level account role (distinct from per-group SUPER_ADMIN/ADMIN/MEMBER).
export const USER_ROLES = ['USER', 'APP_OWNER'] as const;
export type UserRole = typeof USER_ROLES[number];

// Account lifecycle status. SUSPENDED/DELETED accounts are denied at the door
// (verifyToken clears their cookies); DELETED is a soft delete.
export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETED'] as const;
export type UserStatus = typeof USER_STATUSES[number];

// Where a user's current plan came from — drives revenue (only PAYMENT counts).
export const PLAN_SOURCES = ['PAYMENT', 'PROMO', 'ADMIN'] as const;
export type PlanSource = typeof PLAN_SOURCES[number];

export const PLAN_TIERS = ['FREE', 'PRO', 'PREMIUM'] as const;
export type Plan = typeof PLAN_TIERS[number];

// Ordinal rank for comparing tiers (e.g. to block a promo from downgrading an
// active higher plan).
export const PLAN_RANK: Record<Plan, number> = { FREE: 0, PRO: 1, PREMIUM: 2 };

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = typeof BILLING_CYCLES[number];

// One-time, time-boxed access: a payment grants access for this many days.
export const BILLING_PERIOD_DAYS: Record<BillingCycle, number> = {
    monthly: 30,
    yearly: 365,
};

// After a paid plan lapses, the account keeps full access for this long before
// it downgrades to FREE entitlements (read-only freeze on over-limit resources).
export const GRACE_PERIOD_DAYS = 7;

export interface PlanLimits {
    maxGroups: number | null;
    maxMembersPerGroup: number | null;
    maxCategoriesPerGroup: number | null;
    eventLogRetentionDays: number | null;
    transactionLogRetentionDays: number | null;
}

export interface PlanFeatures {
    advancedReportRange: boolean; // all_time / custom report ranges
    cloneGroup: boolean;
}

export interface PlanConfig {
    name: string;
    priceMonthly: number; // rupees
    priceYearly: number; // rupees (full-year total)
    limits: PlanLimits;
    features: PlanFeatures;
}

export const PLANS: Record<Plan, PlanConfig> = {
    FREE: {
        name: 'Free',
        priceMonthly: 0,
        priceYearly: 0,
        limits: {
            maxGroups: 3,
            maxMembersPerGroup: 5,
            maxCategoriesPerGroup: 10,
            eventLogRetentionDays: 15,
            transactionLogRetentionDays: 30,
        },
        features: { advancedReportRange: false, cloneGroup: false },
    },
    PRO: {
        name: 'Pro',
        priceMonthly: 69,
        priceYearly: 660,
        limits: {
            maxGroups: 8,
            maxMembersPerGroup: 10,
            maxCategoriesPerGroup: 20,
            eventLogRetentionDays: 60,
            transactionLogRetentionDays: 100,
        },
        features: { advancedReportRange: true, cloneGroup: true },
    },
    PREMIUM: {
        name: 'Premium',
        priceMonthly: 119,
        priceYearly: 1140,
        limits: {
            maxGroups: null,
            maxMembersPerGroup: null,
            maxCategoriesPerGroup: null,
            eventLogRetentionDays: null,
            transactionLogRetentionDays: null,
        },
        features: { advancedReportRange: true, cloneGroup: true },
    },
};
