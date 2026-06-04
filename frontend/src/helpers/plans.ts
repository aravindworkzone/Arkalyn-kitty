// Static plan catalogue for PUBLIC pages (landing pricing section + the
// detailed subscription-plans page). These pages render before login, but the
// live `/subscription/plans` API requires auth (verifyToken) — so we mirror the
// backend `PLANS` constant here for unauthenticated display only.
//
// ⚠️ Keep in sync with backend/config/constants.ts → PLANS. Authenticated flows
// (PricingPage upgrade/checkout) still read the live API via useGetPlansQuery.

import type { PlanTier, PlanConfig } from '../interface/subscription';

export const PUBLIC_PLANS: Record<PlanTier, PlanConfig> = {
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

export const TIER_ORDER: PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];

// One-time, time-boxed access (mirrors BILLING_PERIOD_DAYS / GRACE_PERIOD_DAYS).
export const BILLING_PERIOD_DAYS: Record<'monthly' | 'yearly', number> = { monthly: 30, yearly: 365 };
export const GRACE_PERIOD_DAYS = 7;

export const fmtLimit = (n: number | null) => (n === null ? 'Unlimited' : String(n));
export const fmtDays = (n: number | null) => (n === null ? 'Unlimited' : `${n} days`);

// Headline feature lines shown on each tier card (mirrors PricingPage.featureLines).
export const planFeatureLines = (tier: PlanTier, cfg: PlanConfig): string[] => {
    const l = cfg.limits;
    const lines = [
        `${fmtLimit(l.maxGroups)} active groups`,
        `${fmtLimit(l.maxMembersPerGroup)} members per group`,
        `${fmtLimit(l.maxCategoriesPerGroup)} categories per group`,
        `${fmtDays(l.transactionLogRetentionDays)} transaction history`,
        `${fmtDays(l.eventLogRetentionDays)} activity history`,
        cfg.features.advancedReportRange ? 'All-time & custom reports' : 'This & last month reports',
    ];
    if (cfg.features.cloneGroup) lines.push('Clone groups in one click');
    if (tier === 'PREMIUM') lines.push('Everything unlimited');
    return lines;
};
