// Static plan catalogue for PUBLIC pages (landing pricing section + the
// detailed subscription-plans page). These pages render before login, but the
// live `/subscription/plans` API requires auth (verifyToken) — so we mirror the
// backend `PLANS` constant here for unauthenticated display only.
//
// ⚠️ Keep in sync with backend/config/constants.ts → PLANS. Authenticated flows
// (PricingPage upgrade/checkout) still read the live API via useGetPlansQuery.
//
// Every tier here is priced and enforced PER GROUP — there is no account plan,
// so a limit like "10 members" means ten members in the group that bought it.

import type { PlanTier, PlanConfig } from '../interface/subscription';

// Ordinal rank for comparing tiers (mirrors backend PLAN_RANK). Used to block
// buying a strictly lower tier while a higher plan is active.
export const PLAN_RANK: Record<PlanTier, number> = { FREE: 0, PRO: 1, PREMIUM: 2 };

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
        features: { advancedReportRange: false, cloneGroup: false, linkGroups: false },
    },
    PRO: {
        name: 'Pro',
        priceMonthly: 69,
        priceYearly: 660,
        limits: {
            maxMembersPerGroup: 10,
            maxCategoriesPerGroup: 20,
            eventLogRetentionDays: 60,
            transactionLogRetentionDays: 100,
        },
        features: { advancedReportRange: true, cloneGroup: true, linkGroups: true },
    },
    PREMIUM: {
        name: 'Premium',
        priceMonthly: 119,
        priceYearly: 1140,
        limits: {
            maxMembersPerGroup: null,
            maxCategoriesPerGroup: null,
            eventLogRetentionDays: null,
            transactionLogRetentionDays: null,
        },
        features: { advancedReportRange: true, cloneGroup: true, linkGroups: true },
    },
};

export const TIER_ORDER: PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];

// One-time, time-boxed access (mirrors BILLING_PERIOD_DAYS / GRACE_PERIOD_DAYS).
export const BILLING_PERIOD_DAYS: Record<'monthly' | 'yearly', number> = { monthly: 30, yearly: 365 };
export const GRACE_PERIOD_DAYS = 7;

export const fmtLimit = (n: number | null) => (n === null ? 'Unlimited' : String(n));
export const fmtDays = (n: number | null) => (n === null ? 'Unlimited' : `${n} days`);

// Headline feature lines shown on each tier card (mirrors PricingPage.featureLines).
// Every line describes what the tier grants THE GROUP it is bought for.
export const planFeatureLines = (tier: PlanTier, cfg: PlanConfig): string[] => {
    const l = cfg.limits;
    const lines = [
        `${fmtLimit(l.maxMembersPerGroup)} members`,
        `${fmtLimit(l.maxCategoriesPerGroup)} categories`,
        `${fmtDays(l.transactionLogRetentionDays)} transaction history`,
        `${fmtDays(l.eventLogRetentionDays)} activity history`,
        cfg.features.advancedReportRange ? 'Custom-range reports' : 'Month & all-time reports',
    ];
    if (cfg.features.cloneGroup) lines.push('Clone this group in one click');
    if (cfg.features.linkGroups) lines.push('Connect to other groups for funding');
    if (tier === 'PREMIUM') lines.push('Everything unlimited');
    return lines;
};
