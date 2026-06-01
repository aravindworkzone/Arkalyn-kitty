import { z } from 'zod';
import { BILLING_CYCLES } from '../config/constants';

// FREE is intentionally excluded — the free tier is never purchased.
export const createOrderBodySchema = z.object({
    plan: z.enum(['PRO', 'PREMIUM']),
    cycle: z.enum(BILLING_CYCLES),
});

export const verifyPaymentBodySchema = z.object({
    razorpay_order_id: z.string().trim().min(1, 'razorpay_order_id is required'),
    razorpay_payment_id: z.string().trim().min(1, 'razorpay_payment_id is required'),
    razorpay_signature: z.string().trim().min(1, 'razorpay_signature is required'),
});

export const redeemPromoBodySchema = z.object({
    code: z
        .string({ message: 'Promo code is required' })
        .trim()
        .min(1, 'Promo code is required')
        .max(60, 'Promo code is too long')
        .toUpperCase(),
});

export type CreateOrderDto = z.infer<typeof createOrderBodySchema>;
export type VerifyPaymentDto = z.infer<typeof verifyPaymentBodySchema>;
export type RedeemPromoDto = z.infer<typeof redeemPromoBodySchema>;
