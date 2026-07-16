import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env';
import { AppError } from '../helpers/AppError';

// Payments are optional infrastructure — if the keys are absent the app still
// runs; order creation throws a clean 503 instead of crashing on boot. Mirrors
// the graceful-degradation pattern used for Resend email (utils/email.ts).
export const isRazorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

export interface RazorpayPayment {
  id: string;
  entity: "payment";
  amount: number; // in paise
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string | null;
  invoice_id: string | null;
  international: boolean;
  method: "card" | "netbanking" | "wallet" | "emi" | "upi";
  amount_refunded: number;
  refund_status: "null" | "partial" | "full" | null;
  captured: boolean;
  description: string | null;
  card_id: string | null;
  card?: {
    id: string;
    entity: "card";
    name: string;
    last4: string;
    network: string;
    type: "credit" | "debit" | "prepaid" | "unknown";
    issuer: string | null;
    international: boolean;
    emi: boolean;
    sub_type: string;
  };
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  email: string;
  contact: string;
  notes: Record<string, string> | any[];
  fee: number | null;
  tax: number | null;
  error_code: string | null;
  error_description: string | null;
  error_source: string | null;
  error_step: string | null;
  error_reason: string | null;
  acquirer_data?: {
    auth_code?: string;
    rrn?: string;
    upi_transaction_id?: string;
  };
  created_at: number;
}

const razorpay = isRazorpayConfigured
    ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
    : null;

interface CreateOrderInput {
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
}

export const getFullRazorpayDetails = async (
  razorpay_payment_id: string
): Promise<RazorpayPayment> => {
  if (!razorpay) throw new AppError('Payments not configured', 503);
  try {
    return (await razorpay.payments.fetch(razorpay_payment_id)) as RazorpayPayment;
  } catch (err: any) {
    const description: string = err?.error?.description ?? 'Payment gateway error';
    const sdkStatus: number = err?.statusCode;
    const httpStatus = sdkStatus >= 400 && sdkStatus < 500 ? 400 : 502;
    throw new AppError(description, httpStatus);
  }
};

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
