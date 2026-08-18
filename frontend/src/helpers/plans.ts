// Static plan catalogue for PUBLIC pages (landing pricing section + the
// detailed subscription-plans page). These pages render before login, but the
// live `/subscription/plans` API requires auth (verifyToken) — so we mirror the
// backend `PLANS` constant here for unauthenticated display only.
//
// ⚠️ Keep in sync with Backend/config/constants.ts → PLANS. Authenticated flows
// (PricingPage upgrade/checkout) still read the live API via useGetPlansQuery.
//
// Every tier here is priced and enforced PER GROUP — there is no account plan,
// so a limit like "25 members" means twenty-five members in the group that
// bought it.

import type { PlanTier, SellableTier, PlanConfig, PlanView } from '../interface/subscription';

// Ordinal rank for comparing tiers (mirrors backend PLAN_RANK). PREMIUM sits
// LEVEL with ORG, not below it: they grant identical entitlements, so a legacy
// PREMIUM group moving to ORG is a lateral renewal, not an upgrade — and must
// not be offered as one.
export const PLAN_RANK: Record<PlanTier, number> = { FREE: 0, PRO: 1, PREMIUM: 2, ORG: 2 };

const UNLIMITED = {
    maxMembersPerGroup: null,
    maxCategoriesPerGroup: null,
    eventLogRetentionDays: null,
    transactionLogRetentionDays: null,
};

const ORG_FEATURES = {
    advancedReportRange: true,
    cloneGroup: true,
    linkGroups: true,
    memberRole: true,
    dataExport: true,
    contributionRequests: true,
    prioritySupport: true,
};

export const PUBLIC_PLANS: Record<PlanTier, PlanConfig> = {
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
    // LEGACY — never rendered on a pricing surface. Present so a group still
    // holding this tier can display its own entitlements.
    PREMIUM: {
        name: 'Premium (legacy)',
        priceMonthly: 99,
        priceYearly: 899,
        limits: UNLIMITED,
        features: ORG_FEATURES,
    },
    ORG: {
        name: 'Organization',
        priceMonthly: 999,
        priceYearly: 9990,
        limits: UNLIMITED,
        features: ORG_FEATURES,
    },
};

// The tiers a pricing surface may render, in display order. PREMIUM is
// deliberately absent — see the note on PUBLIC_PLANS.PREMIUM.
export const TIER_ORDER: SellableTier[] = ['FREE', 'PRO', 'ORG'];

// The highest rank anyone can buy. Used to answer "is there anything left to
// upgrade to?" without naming a tier — spelling that as `tier !== 'ORG'` breaks
// the moment a tier is added or retired, which is exactly what just happened to
// the old `tier !== 'PREMIUM'` check.
export const MAX_TIER_RANK = Math.max(...TIER_ORDER.map((t) => PLAN_RANK[t]));

// Whether this group has a higher tier available to buy. False on the top tier,
// and false for a legacy PREMIUM group, which already holds ORG-equivalent
// entitlements and has nothing to gain from a lateral purchase.
export const hasUpgradeAvailable = (tier: PlanTier): boolean =>
    (PLAN_RANK[tier] ?? 0) < MAX_TIER_RANK;

// One-time, time-boxed access (mirrors BILLING_PERIOD_DAYS / GRACE_PERIOD_DAYS).
export const BILLING_PERIOD_DAYS: Record<'monthly' | 'yearly', number> = { monthly: 30, yearly: 365 };
export const GRACE_PERIOD_DAYS = 7;

export const fmtLimit = (n: number | null) => (n === null ? 'Unlimited' : String(n));
export const fmtDays = (n: number | null) => (n === null ? 'Unlimited' : `${n} days`);

// Yearly price expressed as an equivalent monthly rate, for the "₹833/mo billed
// annually" line. Floors rather than rounds so the figure is never higher than
// what the customer actually pays per month.
export const monthlyEquivalent = (cfg: PlanConfig) => Math.floor(cfg.priceYearly / 12);

export const yearlySavingPct = (cfg: PlanConfig) => {
    if (!cfg.priceMonthly || !cfg.priceYearly) return 0;
    return Math.round((1 - cfg.priceYearly / (cfg.priceMonthly * 12)) * 100);
};

// Whether the export/download UI should be offered.
//
// This is the ONE entitlement that must not be read off `subscription.features`,
// because the server intentionally disagrees with it: export is checked against
// the STORED tier, so a lapsed Organization group can still pull its records
// out. Gating the button on the effective plan would hide a download the API
// would happily serve. Mirrors Backend/helpers/planLimits → canExportData.
export const canExport = (sub: PlanView | null | undefined): boolean => {
    if (!sub) return false;
    // `storedTier` is what the group bought, so this stays true through a lapse —
    // and, unlike checking `status === 'expired'`, does NOT wrongly light up for a
    // lapsed Pro group, which never had export in the first place.
    return Boolean(PUBLIC_PLANS[sub.storedTier]?.features.dataExport);
};

export const planFeatureLines = (tier: PlanTier, cfg: PlanConfig): string[] => {
    const l = cfg.limits;
    const lines = [
        `${fmtLimit(l.maxMembersPerGroup)} members`,
        `${fmtLimit(l.maxCategoriesPerGroup)} categories`,
        `${fmtDays(l.transactionLogRetentionDays)} transaction history`,
        `${fmtDays(l.eventLogRetentionDays)} activity history`,
        cfg.features.advancedReportRange ? 'Custom-range reports' : 'Month & all-time reports',
    ];
    lines.push(
        cfg.features.memberRole
            ? 'Admin & member roles'
            : 'Everyone who joins is an admin'
    );
    if (cfg.features.cloneGroup) lines.push('Clone this group in one click');
    if (cfg.features.linkGroups) lines.push('Receive funding from other groups');
    if (cfg.features.dataExport) lines.push('CSV export & auditor pack');
    if (cfg.features.prioritySupport) lines.push('Priority support');
    return lines;
};
