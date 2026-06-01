import { useGetUserQuery } from "../redux/api/auth";
import type { PlanView } from "../interface/subscription";

// Fallback used while /user/me is loading or for older payloads without a
// subscription block — mirrors the backend FREE entitlements.
const FREE_VIEW: PlanView = {
    tier: 'FREE',
    status: 'active',
    isReadOnly: false,
    planExpiresAt: null,
    limits: {
        maxGroups: 3,
        maxMembersPerGroup: 5,
        maxCategoriesPerGroup: 10,
        eventLogRetentionDays: 15,
        transactionLogRetentionDays: 30,
    },
    features: { advancedReportRange: false, cloneGroup: false },
};

// Reads the current user's effective plan from the cached /user/me query so any
// component can gate features without prop-drilling.
export function usePlan() {
    const { data, isLoading } = useGetUserQuery();
    const subscription: PlanView = data?.data?.user?.subscription ?? FREE_VIEW;

    return {
        isLoading,
        plan: subscription,
        tier: subscription.tier,
        status: subscription.status,
        limits: subscription.limits,
        features: subscription.features,
        isPaid: subscription.tier !== 'FREE',
    };
}
