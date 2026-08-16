// Subscription tier shapes — mirror backend/config/constants.ts (PLANS) and the
// plan view returned by GET /group/:id and /subscription/verify.
//
// Plans are GROUP-scoped: a subscription is bought for one group and every limit
// and feature below applies to that group alone. There is no account tier, so
// nothing here hangs off the current user.

// PREMIUM is a LEGACY stored value, not a purchasable tier. It stays in the
// union because groups and historical receipts still carry it and the UI has to
// render them; it is absent from SELLABLE_TIERS, so no pricing card or checkout
// path offers it. ORG replaced it at identical entitlements.
export type PlanTier = 'FREE' | 'PRO' | 'PREMIUM' | 'ORG';
export type SellableTier = 'FREE' | 'PRO' | 'ORG';
export type BillingCycle = 'monthly' | 'yearly';
export type PlanStatus = 'active' | 'grace' | 'expired';

export interface PlanLimits {
    maxMembersPerGroup: number | null; // null = unlimited
    maxCategoriesPerGroup: number | null;
    eventLogRetentionDays: number | null;
    transactionLogRetentionDays: number | null;
}

export interface PlanFeatures {
    advancedReportRange: boolean;
    cloneGroup: boolean;
    linkGroups: boolean;
    // The MEMBER role — someone who shares the pool but cannot administer the
    // group. Without it a group is flat: everyone who joins lands as ADMIN.
    memberRole: boolean;
    // Organization tier. `dataExport` is the one flag the UI must not gate on
    // alone: the server lets a LAPSED org group keep exporting, so the download
    // button reads the stored tier via `canExport` in helpers/plans.
    dataExport: boolean;
    contributionRequests: boolean;
    prioritySupport: boolean;
}

export interface PlanConfig {
    name: string;
    priceMonthly: number;
    priceYearly: number;
    limits: PlanLimits;
    features: PlanFeatures;
}

// The catalogue keyed by tier — carries every tier, legacy PREMIUM included, so
// a group sitting on one can still render its own entitlements.
export type PlansResponse = Record<PlanTier, PlanConfig>;

// The full GET /subscription/plans payload. `sellable` is the ordered list the
// pricing table draws; purchasability must never be derived from the catalogue
// keys, or the retired tier reappears on the checkout page.
export interface PlansEnvelope {
    plans: PlansResponse;
    sellable: SellableTier[];
    paymentsEnabled: boolean;
}

// The effective subscription attached to a group.
export interface PlanView {
    tier: PlanTier;
    // What the group actually bought. `tier` collapses to FREE once a plan lapses
    // past grace, which loses the information needed to tell a lapsed Pro group
    // from a lapsed Organization one — the distinction the export rule turns on.
    storedTier: PlanTier;
    status: PlanStatus;
    isReadOnly: boolean;
    planExpiresAt: string | null;
    limits: PlanLimits;
    features: PlanFeatures;
}

export interface CreateOrderResponse {
    orderId: string;
    amount: number; // paise
    currency: string;
    keyId: string;
    // The group this checkout upgrades — echoed back so the confirmation can
    // name it.
    groupId: string;
    groupName: string;
    plan: PlanTier;
    cycle: BillingCycle;
}

export type PaymentStatus = 'created' | 'paid' | 'failed';

// One subscription checkout attempt, for the profile Transactions section.
export interface SubscriptionTransaction {
    id: string;
    // Which group the plan was bought for. null only if that group was later
    // hard-deleted — the receipt itself still stands.
    group: { id: string; name: string; displayId: string } | null;
    plan: PlanTier;
    cycle: BillingCycle;
    amount: number; // rupees
    status: PaymentStatus;
    razorpayPaymentId: string | null;
    createdAt: string;
}
