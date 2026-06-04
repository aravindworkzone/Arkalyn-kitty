// Subscription tier shapes — mirror backend/config/constants.ts (PLANS) and the
// plan view returned by /user/me and /subscription/verify.

export type PlanTier = 'FREE' | 'PRO' | 'PREMIUM';
export type BillingCycle = 'monthly' | 'yearly';
export type PlanStatus = 'active' | 'grace' | 'expired';

export interface PlanLimits {
    maxGroups: number | null; // null = unlimited
    maxMembersPerGroup: number | null;
    maxCategoriesPerGroup: number | null;
    eventLogRetentionDays: number | null;
    transactionLogRetentionDays: number | null;
}

export interface PlanFeatures {
    advancedReportRange: boolean;
    cloneGroup: boolean;
}

export interface PlanConfig {
    name: string;
    priceMonthly: number;
    priceYearly: number;
    limits: PlanLimits;
    features: PlanFeatures;
}

export type PlansResponse = Record<PlanTier, PlanConfig>;

// The effective subscription attached to the logged-in user.
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
    plan: PlanTier;
    cycle: BillingCycle;
}

export type PaymentStatus = 'created' | 'paid' | 'failed';

// One subscription checkout attempt, for the profile Transactions section.
export interface SubscriptionTransaction {
    id: string;
    plan: PlanTier;
    cycle: BillingCycle;
    amount: number; // rupees
    status: PaymentStatus;
    razorpayPaymentId: string | null;
    createdAt: string;
}
