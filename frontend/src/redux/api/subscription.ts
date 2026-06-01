import { api } from "./base";
import type {
    PlansResponse,
    CreateOrderResponse,
    PlanView,
    PlanTier,
    BillingCycle,
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
            // Refresh /user/me so gated UI updates immediately after upgrade.
            invalidatesTags: ['Auth'],
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
    useRedeemPromoCodeMutation,
} = subscription;
