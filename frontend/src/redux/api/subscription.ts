import { api } from "./base";
import type {
    PlansResponse,
    CreateOrderResponse,
    PlanView,
    PlanTier,
    BillingCycle,
    SubscriptionTransaction,
} from "../../interface/subscription";

export const subscription = api.injectEndpoints({
    endpoints: (builder) => ({
        // `paymentsEnabled` is false when the deployment has no Razorpay keys.
        // Checkout would 503, so the UI disables it up front and points at promo
        // codes, which never touch the gateway.
        getPlans: builder.query<{ plans: PlansResponse; paymentsEnabled: boolean }, void>({
            query: () => '/subscription/plans',
            transformResponse: (res: { data: { plans: PlansResponse; paymentsEnabled: boolean } }) => res.data,
        }),
        // Checkout is always for one group — the backend authorizes the caller as
        // an admin of it before creating the order.
        createSubscriptionOrder: builder.mutation<
            CreateOrderResponse,
            { groupId: string; plan: PlanTier; cycle: BillingCycle }
        >({
            query: (body) => ({ url: '/subscription/order', method: 'POST', body }),
            transformResponse: (res: { data: { order: CreateOrderResponse } }) => res.data.order,
        }),
        verifySubscriptionPayment: builder.mutation<
            PlanView,
            { groupId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
        >({
            // groupId is carried for cache invalidation only and is deliberately
            // not sent — the backend recovers the group from the stored order, so
            // a client-supplied one could only ever disagree with it.
            query: ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => ({
                url: '/subscription/verify',
                method: 'POST',
                body: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
            }),
            transformResponse: (res: { data: { plan: PlanView } }) => res.data.plan,
            // The upgraded group's payload carries the new entitlement, so its
            // cache entry has to go for gated UI to update immediately. The
            // Transactions list refreshes so the row flips to Success.
            invalidatesTags: (_r, _e, { groupId }) => [{ type: 'Group', id: groupId }, 'Group', 'Subscription'],
        }),
        markSubscriptionPaymentFailed: builder.mutation<
            { updated: boolean },
            { razorpay_order_id: string }
        >({
            query: (body) => ({ url: '/subscription/payment-failed', method: 'POST', body }),
            transformResponse: (res: { data: { updated: boolean } }) => res.data,
            invalidatesTags: ['Subscription'],
        }),
        getSubscriptionTransactions: builder.query<SubscriptionTransaction[], void>({
            query: () => '/subscription/transactions',
            transformResponse: (res: { data: { transactions: SubscriptionTransaction[] } }) => res.data.transactions,
            providesTags: ['Subscription'],
        }),
        deleteSubscriptionTransaction: builder.mutation<{ deleted: boolean }, { id: string }>({
            query: ({ id }) => ({ url: `/subscription/transactions/${id}`, method: 'DELETE' }),
            transformResponse: (res: { data: { deleted: boolean } }) => res.data,
            invalidatesTags: ['Subscription'],
        }),
        redeemPromoCode: builder.mutation<PlanView, { groupId: string; code: string }>({
            query: (body) => ({ url: '/subscription/redeem', method: 'POST', body }),
            transformResponse: (res: { data: { plan: PlanView } }) => res.data.plan,
            invalidatesTags: (_r, _e, { groupId }) => [{ type: 'Group', id: groupId }, 'Group'],
        }),
    }),
});

export const {
    useGetPlansQuery,
    useCreateSubscriptionOrderMutation,
    useVerifySubscriptionPaymentMutation,
    useMarkSubscriptionPaymentFailedMutation,
    useGetSubscriptionTransactionsQuery,
    useDeleteSubscriptionTransactionMutation,
    useRedeemPromoCodeMutation,
} = subscription;
