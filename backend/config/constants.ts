export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

// Anti-CSRF nonce for the Google OAuth round trip. Minted by /auth/oauth/start,
// stored HttpOnly so the page (and any attacker) can't read or forge it, and
// compared against the `state` query param on the callback. Single-use.
export const OAUTH_STATE_COOKIE = 'oauthState';
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

// Pinned, never env-driven: a configurable token endpoint would let a bad env
// value swap in an attacker-controlled issuer and mint arbitrary identities.
export const GOOGLE_AUTH_URI = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
export const GOOGLE_OAUTH_SCOPE = 'openid email profile';

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
    // Session upkeep (/auth/refresh) and the OAuth round trip are NOT credential
    // guessing surfaces: refresh needs an already-valid signed token, and the
    // OAuth legs are browser redirects. They used to share AUTH_MAX_ATTEMPTS,
    // which meant a handful of open tabs renewing at once could 429 a refresh —
    // and the client reads a failed refresh as "session dead" and bounces the
    // user to /login despite a perfectly good session.
    SESSION_WINDOW_MS: 15 * 60 * 1000,
    SESSION_MAX_REQUESTS: 120,
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
//
// Subscriptions are GROUP-scoped: a plan is bought for one group and every
// entitlement below applies to that group alone. Accounts have no tier — a user
// can own a Premium group and a Free one at the same time, and any admin of a
// group can pay to lift its limits.

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

// PREMIUM is LEGACY. It is retained in the enum — and in PLANS below — because
// groups already carry it in `plan`, `planSnapshot.tier` and on historical
// SubscriptionPayment rows; removing the value would strand that data behind a
// schema enum that no longer accepts it. It is not sold: it is absent from
// SELLABLE_TIERS, so checkout and promo creation both reject it, and the pricing
// UI never renders it. Existing PREMIUM groups keep full ORG-equivalent
// entitlements until they lapse, then renew onto ORG like everyone else.
export const PLAN_TIERS = ['FREE', 'PRO', 'PREMIUM', 'ORG'] as const;
export type Plan = typeof PLAN_TIERS[number];

// The tiers a customer can actually buy today. Checkout, promo codes and the
// public pricing table all read this rather than PLAN_TIERS, which is the
// storage enum and still carries the legacy value.
export const SELLABLE_TIERS = ['FREE', 'PRO', 'ORG'] as const;
export type SellablePlan = typeof SELLABLE_TIERS[number];

export const isSellablePlan = (p: Plan): p is SellablePlan =>
    (SELLABLE_TIERS as readonly string[]).includes(p);

export const AUTH_PROVIDERS = ['LOCAL', 'GOOGLE'] as const;
export type AuthProvider = typeof AUTH_PROVIDERS[number];

// Ordinal rank for comparing tiers (e.g. to block a promo from downgrading an
// active higher plan). PREMIUM sits level with ORG, not below it: the two grant
// identical entitlements, so a legacy PREMIUM group moving to ORG is a lateral
// renewal and must not be rejected as a downgrade.
export const PLAN_RANK: Record<Plan, number> = { FREE: 0, PRO: 1, PREMIUM: 2, ORG: 2 };

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

// Hard ceiling on how many active groups one account may own. This is an
// anti-abuse guard, NOT a billing lever: with per-group subscriptions there is
// no account-level tier that could scale it, and every group a user creates is
// FREE (and separately limited) until someone pays for it.
export const MAX_ACTIVE_OWNED_GROUPS = 50;

export interface PlanLimits {
    maxMembersPerGroup: number | null;
    maxCategoriesPerGroup: number | null;
    eventLogRetentionDays: number | null;
    transactionLogRetentionDays: number | null;
}

export interface PlanFeatures {
    // Custom (hand-picked) report date ranges. The named presets, all_time
    // included, are free — the flag name predates that split.
    advancedReportRange: boolean;
    cloneGroup: boolean;
    // Group-to-group funding links. Gates the write paths only — an expired
    // plan can still read its existing connections.
    linkGroups: boolean;
    // The MEMBER role: a participant who takes part in the pool but cannot
    // administer the group. A group without it is FLAT — everyone who joins
    // lands as ADMIN, because there is no lesser role to put them in.
    //
    // Gates NEW role assignments only. A group that lapses keeps the MEMBERs it
    // already has rather than silently promoting them, which would hand
    // group-management rights to people who never had them — the same
    // freeze-don't-rewrite rule the other limits follow.
    memberRole: boolean;

    // --- Organization tier ---------------------------------------------------
    // The three below are what an institutional treasurer buys. They are
    // deliberately absent from PRO: a flatmate kitty never needs them, and a
    // committee that answers to an auditor cannot operate without them.

    // CSV export of the ledger, expenses and member contributions, plus the
    // combined audit pack. Read-only by nature, so a lapsed group keeps the
    // right to pull its own data out — see EXPORT_SURVIVES_LAPSE.
    dataExport: boolean;
    // Admin raises a payable request against members; each gets a Razorpay
    // payment link and settles straight into the pool with a CREDIT entry.
    contributionRequests: boolean;
    // Named support contact + a stated response window. No code path gates on
    // this; it is a catalogue line the pricing table renders.
    prioritySupport: boolean;
}

export interface PlanConfig {
    name: string;
    priceMonthly: number; // rupees
    priceYearly: number; // rupees (full-year total)
    limits: PlanLimits;
    features: PlanFeatures;
}

// The unlimited entitlement set, shared by ORG and its legacy PREMIUM twin so
// the two can never drift apart while both are in the wild.
const UNLIMITED_LIMITS: PlanLimits = {
    maxMembersPerGroup: null,
    maxCategoriesPerGroup: null,
    eventLogRetentionDays: null,
    transactionLogRetentionDays: null,
};

const ORG_FEATURES: PlanFeatures = {
    advancedReportRange: true,
    cloneGroup: true,
    linkGroups: true,
    memberRole: true,
    dataExport: true,
    contributionRequests: true,
    prioritySupport: true,
};

export const PLANS: Record<Plan, PlanConfig> = {
    // Free is the funnel, not a trial. It has to be genuinely enough for a
    // flatmate kitty — 5 people, 10 categories — because those users are never
    // going to pay and their groups are how the organizational buyer hears about
    // the product in the first place.
    FREE: {
        name: 'Free',
        priceMonthly: 0,
        priceYearly: 0,
        limits: {
            maxMembersPerGroup: 5,
            maxCategoriesPerGroup: 10,
            eventLogRetentionDays: 15,
            transactionLogRetentionDays: 30,
        },
        features: {
            advancedReportRange: false,
            cloneGroup: false,
            linkGroups: false,
            memberRole: false,
            dataExport: false,
            contributionRequests: false,
            prioritySupport: false,
        },
    },
    // Pro is the large-informal-group tier: a 25-person trip, a hostel mess, a
    // team kitty. Retention is a year because "what did we spend last Diwali"
    // is the question this tier exists to answer.
    PRO: {
        name: 'Pro',
        priceMonthly: 199,
        priceYearly: 1990,
        limits: {
            maxMembersPerGroup: 25,
            maxCategoriesPerGroup: 50,
            eventLogRetentionDays: 180,
            transactionLogRetentionDays: 365,
        },
        features: {
            advancedReportRange: true,
            cloneGroup: true,
            linkGroups: true,
            memberRole: true,
            dataExport: false,
            contributionRequests: false,
            prioritySupport: false,
        },
    },
    // LEGACY — not sellable. Kept so existing rows resolve; mirrors ORG exactly.
    PREMIUM: {
        name: 'Premium (legacy)',
        priceMonthly: 99,
        priceYearly: 899,
        limits: UNLIMITED_LIMITS,
        features: ORG_FEATURES,
    },
    // The tier the business is actually built on. Twenty of these covers the
    // revenue target, which is why everything an auditor, treasurer or committee
    // secretary needs lives here and nowhere else.
    ORG: {
        name: 'Organization',
        priceMonthly: 999,
        priceYearly: 9990,
        limits: UNLIMITED_LIMITS,
        features: ORG_FEATURES,
    },
};

// A group that lapses loses its paid capabilities, but never the right to take
// its own records out — locking a treasurer out of their own ledger export is
// hostage-taking, not a paywall, and it is the single fastest way to lose an
// institutional customer. `dataExport` is therefore checked against the STORED
// tier rather than the effective one (see helpers/planLimits → canExportData).
export const EXPORT_SURVIVES_LAPSE = true;
