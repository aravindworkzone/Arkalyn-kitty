import mongoose from 'mongoose';
import User from '../models/user.model';
import SubscriptionPayment from '../models/subscription_payment.model';
import PromoCode from '../models/promo_code.model';
import PromoRedemption from '../models/promo_redemption.model';
import { AppError } from '../helpers/AppError';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { toDBAmount } from '../helpers/Money';
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature, getFullRazorpayDetails, type RazorpayPayment } from '../utils/razorpay';
import { getEffectivePlan, toPlanView } from '../helpers/planLimits';
import { PLANS, PLAN_RANK, BILLING_PERIOD_DAYS, type Plan, type BillingCycle } from '../config/constants';

const DAY_MS = 24 * 60 * 60 * 1000;

// New expiry for a grant: renewing the same tier while still active extends from
// the current expiry; otherwise access starts now.
const computeGrantExpiry = (
    currentPlan: Plan,
    currentExpiry: Date | null,
    plan: Plan,
    periodDays: number
): Date => {
    const now = Date.now();
    const cur = currentExpiry ? currentExpiry.getTime() : 0;
    const base = currentPlan === plan && cur > now ? cur : now;
    return new Date(base + periodDays * DAY_MS);
};

export const getPlansService = () => PLANS;

export const createSubscriptionOrderService = async (
    userId: mongoose.Types.ObjectId,
    plan: Plan,
    cycle: BillingCycle
) => {
    if (plan === 'FREE') throw new AppError('The Free plan does not require payment', 400);

    const buyer = await User.findById(userId).select('plan planExpiresAt');
    if (buyer) {
        const eff = getEffectivePlan({ plan: buyer.plan, planExpiresAt: buyer.planExpiresAt });
        if ((eff.status === 'active' || eff.status === 'grace') && PLAN_RANK[eff.tier] > PLAN_RANK[plan]) {
            throw new AppError(
                `You're on the ${eff.tier} plan; downgrading to ${plan} isn't allowed while it's active.`,
                400
            );
        }
    }

    const config = PLANS[plan];
    const priceRupees = cycle === 'yearly' ? config.priceYearly : config.priceMonthly;
    if (!priceRupees || priceRupees <= 0) throw new AppError('Invalid plan price', 400);

    const periodDays = BILLING_PERIOD_DAYS[cycle];
    const amountPaise = toDBAmount(priceRupees);

    const order = await createRazorpayOrder({
        amountPaise,
        receipt: `sub_${userId.toString().slice(-10)}_${Date.now().toString(36)}`,
        notes: { userId: userId.toString(), plan, cycle },
    });

    await SubscriptionPayment.create({
        userId,
        plan,
        cycle,
        amount: priceRupees,
        periodDays,
        razorpayOrderId: order.id,
        status: 'created',
    });

    return {
        orderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        keyId: env.RAZORPAY_KEY_ID,
        plan,
        cycle,
    };
};

const grantFromPayment = async (razorpayOrderId: string, razorpayPaymentId: string) => {

    const payment = await SubscriptionPayment.findOneAndUpdate(
        { razorpayOrderId, status: { $in: ['created', 'failed'] } },
        { status: 'paid', razorpayPaymentId },
        { new: true }
    );

    if (!payment) {
        const existing = await SubscriptionPayment.findOne({ razorpayOrderId });
        if (!existing) throw new AppError('Payment not found', 404);
        const u = await User.findById(existing.userId).select('plan planExpiresAt');
        return getEffectivePlan({ plan: u?.plan, planExpiresAt: u?.planExpiresAt });
    }

    const user = await User.findById(payment.userId).select('plan planExpiresAt planCycle planSource');
    if (!user) throw new AppError('User not found', 404);

    user.planExpiresAt = computeGrantExpiry(user.plan, user.planExpiresAt, payment.plan, payment.periodDays);
    user.plan = payment.plan;
    user.planCycle = payment.cycle;
    user.planSource = 'PAYMENT';
    await user.save();

    return getEffectivePlan({ plan: user.plan, planExpiresAt: user.planExpiresAt });
};

export const verifySubscriptionPaymentService = async (
    userId: mongoose.Types.ObjectId,
    data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; }
) => {
    if (!verifyPaymentSignature(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature)) {
        throw new AppError('Payment signature verification failed', 400);
    }

    const razorpay_payment = await getFullRazorpayDetails(data.razorpay_payment_id);

    const payment = await SubscriptionPayment.findOne({ razorpayOrderId: data.razorpay_order_id });
    if (!payment) throw new AppError('Payment not found', 404);
    if (!payment.userId.equals(userId)) throw new AppError('Forbidden', 403);

    if (razorpay_payment.status !== 'captured' && razorpay_payment.status !== 'authorized') {
        throw new AppError('Payment not completed', 400);
    }
    // payment.amount is exposed in rupees via the schema getter; the gateway
    // reports paise, so normalise before comparing.
    if (toDBAmount(payment.amount) !== razorpay_payment.amount) {
        throw new AppError('Payment amount mismatch', 400);
    }

    const eff = await grantFromPayment(data.razorpay_order_id, data.razorpay_payment_id);
    return toPlanView(eff);
};

export const handleSubscriptionWebhookService = async (
    rawBody: Buffer,
    signature: string
): Promise<void> => {
    if (!verifyWebhookSignature(rawBody, signature)) {
        throw new AppError('Invalid webhook signature', 400);
    }

    let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } } };
    try {
        event = JSON.parse(rawBody.toString('utf8'));
    } catch {
        throw new AppError('Invalid webhook payload', 400);
    }

    if (event.event === 'payment.captured') {
        const entity = event.payload?.payment?.entity;
        if (entity?.order_id && entity.id) {
            try {
                const payment = await SubscriptionPayment.findOne({ razorpayOrderId: entity.order_id });
                if (!payment) throw new AppError('Payment not found', 404);
                if (toDBAmount(payment.amount) !== entity.amount) {
                    throw new AppError('Webhook amount mismatch', 400);
                }
                await grantFromPayment(entity.order_id, entity.id);
            } catch (err) {
                logger.error({ err, orderId: entity.order_id }, 'Webhook subscription grant failed');
            }
        }
    }
};

export const markPaymentFailedService = async (
    userId: mongoose.Types.ObjectId,
    razorpayOrderId: string
) => {
    const updated = await SubscriptionPayment.findOneAndUpdate(
        { razorpayOrderId, userId, status: 'created' },
        { status: 'failed' },
        { new: true }
    );
    return { updated: Boolean(updated) };
};

export const listSubscriptionPaymentsService = async (userId: mongoose.Types.ObjectId) => {
    const rows = await SubscriptionPayment.find({ userId, isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(50);
    return rows.map((r) => ({
        id: r._id.toString(),
        plan: r.plan,
        cycle: r.cycle,
        amount: r.amount,
        status: r.status,
        razorpayPaymentId: r.razorpayPaymentId ?? null,
        createdAt: r.createdAt,
    }));
};

export const softDeleteSubscriptionPaymentService = async (
    userId: mongoose.Types.ObjectId,
    paymentId: string
) => {
    const updated = await SubscriptionPayment.findOneAndUpdate(
        { _id: paymentId, userId, isDeleted: { $ne: true } },
        { isDeleted: true },
        { new: true }
    );
    if (!updated) throw new AppError('Transaction not found', 404);
    return { deleted: true };
};

export const redeemPromoCodeService = async (userId: mongoose.Types.ObjectId, codeRaw: string) => {
    const code = codeRaw.trim().toUpperCase();

    const promo = await PromoCode.findOne({ code });
    if (!promo) throw new AppError('Invalid promo code', 404);
    if (!promo.isActive) throw new AppError('This promo code is no longer active', 400);
    if (promo.expiresAt && promo.expiresAt.getTime() <= Date.now()) {
        throw new AppError('This promo code has expired', 400);
    }
    if (promo.maxRedemptions !== null && promo.redemptionCount >= promo.maxRedemptions) {
        throw new AppError('This promo code has reached its redemption limit', 409);
    }

    const user = await User.findById(userId).select('plan planExpiresAt');
    if (!user) throw new AppError('User not found', 404);
    const eff = getEffectivePlan({ plan: user.plan, planExpiresAt: user.planExpiresAt });
    if ((eff.status === 'active' || eff.status === 'grace') && PLAN_RANK[eff.tier] > PLAN_RANK[promo.plan]) {
        throw new AppError(`You're already on the ${eff.tier} plan, which is higher than this code grants.`, 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        try {
            await PromoRedemption.create(
                [{ promoCodeId: promo._id, code: promo.code, userId, plan: promo.plan, periodDays: promo.periodDays }],
                { session }
            );
        } catch (e: any) {
            if (e.code === 11000) throw new AppError('You have already redeemed this promo code', 409);
            throw e;
        }

        const claimed = await PromoCode.findOneAndUpdate(
            {
                _id: promo._id,
                isActive: true,
                $and: [
                    { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
                    {
                        $expr: {
                            $or: [
                                { $eq: ['$maxRedemptions', null] },
                                { $lt: ['$redemptionCount', '$maxRedemptions'] },
                            ],
                        },
                    },
                ],
            },
            { $inc: { redemptionCount: 1 } },
            { new: true, session }
        );
        if (!claimed) throw new AppError('This promo code has reached its redemption limit', 409);

        const freshUser = await User.findById(userId).select('plan planExpiresAt planCycle planSource').session(session);
        if (!freshUser) throw new AppError('User not found', 404);

        freshUser.planExpiresAt = computeGrantExpiry(freshUser.plan, freshUser.planExpiresAt, promo.plan, promo.periodDays);
        freshUser.plan = promo.plan;
        freshUser.planCycle = promo.cycle;
        freshUser.planSource = 'PROMO';
        await freshUser.save({ session });

        await session.commitTransaction();
        return toPlanView(getEffectivePlan({ plan: freshUser.plan, planExpiresAt: freshUser.planExpiresAt }));
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};
