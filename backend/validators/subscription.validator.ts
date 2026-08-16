import { z } from 'zod';
import { BILLING_CYCLES } from '../config/constants';
import { objectIdSchema, groupIdParamSchema } from './common';

// `groupId` names the group being upgraded — plans are bought per group, never
// per account. It must survive parsing because loadGroup reads it off the body
// to resolve and authorize the target.
//
// PREMIUM is deliberately absent: it is a legacy stored value, not a purchasable
// tier, so a checkout naming it is rejected at the door rather than deeper in
// the service. ORG is its replacement at the same entitlements.
export const createOrderBodySchema = z.object({
    groupId: groupIdParamSchema,
    plan: z.enum(['PRO', 'ORG']),
    cycle: z.enum(BILLING_CYCLES),
});

export const verifyPaymentBodySchema = z.object({
    razorpay_order_id: z.string().trim().min(1, 'razorpay_order_id is required'),
    razorpay_payment_id: z.string().trim().min(1, 'razorpay_payment_id is required'),
    razorpay_signature: z.string().trim().min(1, 'razorpay_signature is required'),
});

export const markPaymentFailedBodySchema = z.object({
    razorpay_order_id: z.string().trim().min(1, 'razorpay_order_id is required'),
});

export const redeemPromoBodySchema = z.object({
    groupId: groupIdParamSchema,
    code: z
        .string({ message: 'Promo code is required' })
        .trim()
        .min(1, 'Promo code is required')
        .max(60, 'Promo code is too long')
        .toUpperCase(),
});

export const transactionIdParamSchema = z.object({
    id: objectIdSchema,
});

export type CreateOrderDto = z.infer<typeof createOrderBodySchema>;
export type VerifyPaymentDto = z.infer<typeof verifyPaymentBodySchema>;
export type RedeemPromoDto = z.infer<typeof redeemPromoBodySchema>;
