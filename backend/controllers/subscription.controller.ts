import {
    getPlansService,
    createSubscriptionOrderService,
    verifySubscriptionPaymentService,
    handleSubscriptionWebhookService,
    redeemPromoCodeService,
} from '../services/subscription.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../helpers/AppError';

export const GetPlans = asyncHandler(async (_req, res) => {
    sendSuccess(res, { plans: getPlansService() }, 'Plans fetched');
});

export const CreateOrder = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const { plan, cycle } = req.body;
    const order = await createSubscriptionOrderService(req.user._id, plan, cycle);
    sendSuccess(res, { order }, 'Order created');
});

export const VerifyPayment = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const plan = await verifySubscriptionPaymentService(req.user._id, req.body);
    sendSuccess(res, { plan }, 'Payment verified');
});

export const RedeemPromo = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const plan = await redeemPromoCodeService(req.user._id, req.body.code);
    sendSuccess(res, { plan }, 'Promo code applied');
});

// Mounted directly in main.ts with a raw-body parser (signature verification
// needs the unparsed bytes), so it lives outside the JSON-parsed router.
export const Webhook = asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    if (typeof signature !== 'string') throw new AppError('Missing webhook signature', 400);
    await handleSubscriptionWebhookService(req.body as Buffer, signature);
    res.status(200).json({ received: true });
});
