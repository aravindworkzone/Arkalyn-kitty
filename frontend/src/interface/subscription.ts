// Subscription tier shapes — mirror backend/config/constants.ts (PLANS) and the
// plan view returned by GET /group/:id and /subscription/verify.
//
// Plans are GROUP-scoped: a subscription is bought for one group and every limit
// and feature below applies to that group alone. There is no account tier, so
// nothing here hangs off the current user.

export type PlanTier = 'FREE' | 'PRO' | 'PREMIUM';
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
}

export interface PlanConfig {
    name: string;
    priceMonthly: number;
    priceYearly: number;
    limits: PlanLimits;
    features: PlanFeatures;
}

export type PlansResponse = Record<PlanTier, PlanConfig>;

// The effective subscription attached to a group.
export interface PlanView {
    tier: PlanTier;
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
