import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env';
import { AppError } from '../helpers/AppError';

// Payments are optional infrastructure — if the keys are absent the app still
// runs; order creation throws a clean 503 instead of crashing on boot. Mirrors
// the graceful-degradation pattern used for Resend email (utils/email.ts).
export const isRazorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

const razorpay = isRazorpayConfigured
    ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
    : null;

interface CreateOrderInput {
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
}

export const createRazorpayOrder = async ({ amountPaise, receipt, notes }: CreateOrderInput) => {
    if (!razorpay) throw new AppError('Payments not configured', 503);
    try {
        return await razorpay.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt,
            notes,
        });
    } catch (err: any) {
        // Razorpay SDK rejects with a plain object { statusCode, error: { description } },
        // not an Error instance — convert it so the error middleware handles it properly.
        const description: string = err?.error?.description ?? 'Payment gateway error';
        const sdkStatus: number = err?.statusCode;
        const httpStatus = sdkStatus >= 400 && sdkStatus < 500 ? 400 : 502;
        throw new AppError(description, httpStatus);
    }
};

// Constant-time hex comparison that tolerates length mismatches (timingSafeEqual
// throws when the buffers differ in length).
const safeEqualHex = (a: string, b: string): boolean => {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

// Verifies the signed checkout response returned to the browser. Razorpay signs
// `${order_id}|${payment_id}` with HMAC-SHA256 keyed on the secret.
export const verifyPaymentSignature = (
    orderId: string,
    paymentId: string,
    signature: string
): boolean => {
    if (!env.RAZORPAY_KEY_SECRET) return false;
    const expected = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    return safeEqualHex(expected, signature);
};

// Verifies a webhook delivery. The signature is HMAC-SHA256 of the *raw* request
// body keyed on the webhook secret — hence the raw-body mount in main.ts.
export const verifyWebhookSignature = (rawBody: Buffer, signature: string): boolean => {
    if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
    const expected = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    return safeEqualHex(expected, signature);
};
