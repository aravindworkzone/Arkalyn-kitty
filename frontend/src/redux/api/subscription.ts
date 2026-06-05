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
        getPlans: builder.query<PlansResponse, void>({
            query: () => '/subscription/plans',
            transformResponse: (res: { data: { plans: PlansResponse } }) => res.data.plans,
        }),
        createSubscriptionOrder: builder.mutation<
            CreateOrderResponse,
            { plan: PlanTier; cycle: BillingCycle }
        >({
            query: (body) => ({ url: '/subscription/order', method: 'POST', body }),
            transformResponse: (res: { data: { order: CreateOrderResponse } }) => res.data.order,
        }),
        verifySubscriptionPayment: builder.mutation<
            PlanView,
            { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
        >({
            query: (body) => ({ url: '/subscription/verify', method: 'POST', body }),
            transformResponse: (res: { data: { plan: PlanView } }) => res.data.plan,
            // Refresh /user/me so gated UI updates immediately after upgrade, and
            // the profile Transactions list so the row flips to Success.
            invalidatesTags: ['Auth', 'Subscription'],
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
        redeemPromoCode: builder.mutation<PlanView, { code: string }>({
            query: (body) => ({ url: '/subscription/redeem', method: 'POST', body }),
            transformResponse: (res: { data: { plan: PlanView } }) => res.data.plan,
            invalidatesTags: ['Auth'],
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
