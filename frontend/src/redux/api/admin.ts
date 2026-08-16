import { api } from "./base";
import type { PaginatedData } from "../../interface/api";
import type {
    AdminUserRow,
    AdminUserDetail,
    AdminGroupSubscriptionRow,
    UserStatus,
    PromoCode,
    PromoRedemption,
    Analytics,
    SystemHealth,
} from "../../interface/admin";
import type { PlanTier, BillingCycle, PlanView } from "../../interface/subscription";

export interface GetAdminUsersArgs {
    page: number;
    limit: number;
    search?: string;
    status?: UserStatus;
    sort?: 'newest' | 'oldest';
}

export interface GetAdminSubscriptionsArgs {
    page: number;
    limit: number;
    search?: string;
    plan?: PlanTier;
    sort?: 'newest' | 'oldest';
}

export const admin = api.injectEndpoints({
    endpoints: (builder) => ({
        // Users
        getAdminUsers: builder.query<PaginatedData<AdminUserRow>, GetAdminUsersArgs>({
            query: ({ page, limit, search, status, sort }) => ({
                url: '/admin/users',
                params: {
                    page,
                    limit,
                    ...(search ? { search } : {}),
                    ...(status ? { status } : {}),
                    ...(sort ? { sort } : {}),
                },
            }),
            transformResponse: (res: { data: PaginatedData<AdminUserRow> }) => res.data,
            providesTags: ['Admin'],
        }),
        getAdminUserDetail: builder.query<AdminUserDetail, string>({
            query: (userId) => `/admin/users/${userId}`,
            transformResponse: (res: { data: AdminUserDetail }) => res.data,
            providesTags: ['Admin'],
        }),
        suspendUser: builder.mutation<unknown, string>({
            query: (userId) => ({ url: `/admin/users/${userId}/suspend`, method: 'POST' }),
            invalidatesTags: ['Admin'],
        }),
        restoreUser: builder.mutation<unknown, string>({
            query: (userId) => ({ url: `/admin/users/${userId}/restore`, method: 'POST' }),
            invalidatesTags: ['Admin'],
        }),
        deleteAdminUser: builder.mutation<unknown, string>({
            query: (userId) => ({ url: `/admin/users/${userId}`, method: 'DELETE' }),
            invalidatesTags: ['Admin'],
        }),
        hardDeleteAdminUser: builder.mutation<unknown, string>({
            query: (userId) => ({ url: `/admin/users/${userId}/hard`, method: 'DELETE' }),
            invalidatesTags: ['Admin'],
        }),
        // Group subscriptions — the plan lives on the group, so both the listing
        // and the override are keyed on one.
        getAdminSubscriptions: builder.query<
            PaginatedData<AdminGroupSubscriptionRow>,
            GetAdminSubscriptionsArgs
        >({
            query: ({ page, limit, search, plan, sort }) => ({
                url: '/admin/subscriptions',
                params: {
                    page,
                    limit,
                    ...(search ? { search } : {}),
                    ...(plan ? { plan } : {}),
                    ...(sort ? { sort } : {}),
                },
            }),
            transformResponse: (res: { data: PaginatedData<AdminGroupSubscriptionRow> }) => res.data,
            providesTags: ['Admin'],
        }),
        overrideGroupPlan: builder.mutation<
            { subscription: PlanView },
            { groupId: string; plan: PlanTier; cycle?: BillingCycle; expiresAt?: string }
        >({
            query: ({ groupId, ...body }) => ({ url: `/admin/groups/${groupId}/plan`, method: 'POST', body }),
            transformResponse: (res: { data: { subscription: PlanView } }) => res.data,
            // The group's own cache entry holds the entitlement the app gates on.
            invalidatesTags: (_r, _e, { groupId }) => ['Admin', { type: 'Group', id: groupId }, 'Group'],
        }),

        // Promo codes
        getPromos: builder.query<PromoCode[], void>({
            query: () => '/admin/promos',
            transformResponse: (res: { data: { promos: PromoCode[] } }) => res.data.promos,
            providesTags: ['AdminPromos'],
        }),
        createPromo: builder.mutation<
            PromoCode,
            { code: string; plan: PlanTier; cycle: BillingCycle; maxRedemptions: number | null; expiresAt?: string }
        >({
            query: (body) => ({ url: '/admin/promos', method: 'POST', body }),
            transformResponse: (res: { data: { promo: PromoCode } }) => res.data.promo,
            invalidatesTags: ['AdminPromos'],
        }),
        deactivatePromo: builder.mutation<unknown, string>({
            query: (id) => ({ url: `/admin/promos/${id}/deactivate`, method: 'POST' }),
            invalidatesTags: ['AdminPromos'],
        }),
        getPromoRedemptions: builder.query<PromoRedemption[], string>({
            query: (id) => `/admin/promos/${id}/redemptions`,
            transformResponse: (res: { data: { redemptions: PromoRedemption[] } }) => res.data.redemptions,
            providesTags: ['AdminPromos'],
        }),

        // Analytics + health
        getAnalytics: builder.query<Analytics, { granularity: 'day' | 'week' | 'month' }>({
            query: ({ granularity }) => ({ url: '/admin/analytics', params: { granularity } }),
            transformResponse: (res: { data: Analytics }) => res.data,
            providesTags: ['Admin'],
        }),
        getAdminHealth: builder.query<SystemHealth, void>({
            query: () => '/admin/health',
            transformResponse: (res: { data: SystemHealth }) => res.data,
        }),
    }),
});

export const {
    useGetAdminUsersQuery,
    useGetAdminUserDetailQuery,
    useSuspendUserMutation,
    useRestoreUserMutation,
    useDeleteAdminUserMutation,
    useHardDeleteAdminUserMutation,
    useGetAdminSubscriptionsQuery,
    useOverrideGroupPlanMutation,
    useGetPromosQuery,
    useCreatePromoMutation,
    useDeactivatePromoMutation,
    useGetPromoRedemptionsQuery,
    useGetAnalyticsQuery,
    useGetAdminHealthQuery,
} = admin;
