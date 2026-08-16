import type { PlanView } from "../interface/subscription";
import { useGetGroupByIdQuery } from "../redux/api/group";

// Fallback used while the group query is in flight, and for any group whose
// payload predates the subscription block — mirrors the backend FREE
// entitlements.
export const FREE_VIEW: PlanView = {
    tier: 'FREE',
    status: 'active',
    isReadOnly: false,
    planExpiresAt: null,
    limits: {
        maxMembersPerGroup: 5,
        maxCategoriesPerGroup: 10,
        eventLogRetentionDays: 15,
        transactionLogRetentionDays: 30,
    },
    features: { advancedReportRange: false, cloneGroup: false, linkGroups: false },
};

// Reads ONE GROUP's effective plan from the cached group query, so any component
// can gate on the same entitlement the backend will enforce for that group.
//
// This is deliberately group-scoped rather than account-scoped: subscriptions are
// bought per group, so "can I do this?" only has an answer once you name the
// group. Every member of a Pro group sees Pro controls — including members who
// have never paid for anything — and an admin who pays elsewhere sees Free
// controls in a Free group.
export function useGroupPlan(groupId: string | undefined) {
    const { data: group, isLoading } = useGetGroupByIdQuery(groupId!, { skip: !groupId });
    const subscription: PlanView = group?.subscription ?? FREE_VIEW;

    return {
        isLoading,
        plan: subscription,
        tier: subscription.tier,
        status: subscription.status,
        limits: subscription.limits,
        features: subscription.features,
        isPaid: subscription.tier !== 'FREE',
        // True once the group is loaded and really is on FREE — lets callers tell
        // "not paid" apart from "not loaded yet", which the fallback hides.
        isResolved: Boolean(group),
    };
}
