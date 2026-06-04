import mongoose from 'mongoose';
import User from '../models/user.model';
import SubscriptionPayment from '../models/subscription_payment.model';
import PromoCode from '../models/promo_code.model';
import PromoRedemption from '../models/promo_redemption.model';
import { AppError } from '../helpers/AppError';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { toDBAmount } from '../helpers/Money';
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from '../utils/razorpay';
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

    // Don't allow buying a strictly lower tier while a paid plan is still active
    // (or in grace). Same-tier renewal and upgrades stay allowed; an expired plan
    // resolves to FREE so anything is purchasable again. Mirrors the promo guard.
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

// Atomic, idempotent grant keyed on the Razorpay order id. The created -> paid
// findOneAndUpdate is the lock: only the first caller (browser callback OR
// webhook) flips the row and applies the entitlement; later callers no-op.
const grantFromPayment = async (razorpayOrderId: string, razorpayPaymentId: string) => {
    // Lock filter includes 'failed' so a capture webhook can still grant an
    // attempt the browser optimistically marked failed (e.g. on dismiss) but
    // Razorpay actually captured. A genuine payment.failed yields no capture
    // event, so it stays failed.
    const payment = await SubscriptionPayment.findOneAndUpdate(
        { razorpayOrderId, status: { $in: ['created', 'failed'] } },
        { status: 'paid', razorpayPaymentId },
        { new: true }
    );

    if (!payment) {
        // Already processed (or unknown order) — return the current effective plan
        // so the caller still gets a coherent response. Idempotent by design.
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
    data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) => {
    if (!verifyPaymentSignature(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature)) {
        throw new AppError('Payment signature verification failed', 400);
    }

    // Ownership guard: the order must belong to the authenticated user.
    const payment = await SubscriptionPayment.findOne({ razorpayOrderId: data.razorpay_order_id });
    if (!payment) throw new AppError('Payment not found', 404);
    if (!payment.userId.equals(userId)) throw new AppError('Forbidden', 403);

    const eff = await grantFromPayment(data.razorpay_order_id, data.razorpay_payment_id);
    return toPlanView(eff);
};

// Server-to-server confirmation. Source of truth even if the browser callback is
// lost. Signature failure rejects (Razorpay retries); a grant failure is logged
// but the handler still resolves so we ack with 200.
export const handleSubscriptionWebhookService = async (
    rawBody: Buffer,
    signature: string
): Promise<void> => {
    if (!verifyWebhookSignature(rawBody, signature)) {
        throw new AppError('Invalid webhook signature', 400);
    }

    let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
    try {
        event = JSON.parse(rawBody.toString('utf8'));
    } catch {
        throw new AppError('Invalid webhook payload', 400);
    }

    if (event.event === 'payment.captured') {
        const entity = event.payload?.payment?.entity;
        if (entity?.order_id && entity.id) {
            try {
                await grantFromPayment(entity.order_id, entity.id);
            } catch (err) {
                logger.error({ err, orderId: entity.order_id }, 'Webhook subscription grant failed');
            }
        }
    }
};

// Marks a still-pending checkout attempt as failed (Razorpay payment.failed, or
// the user dismissed the modal). Only flips created -> failed; never overwrites a
// granted (paid) row, and ownership is enforced in the filter.
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

// The user's recent subscription payment attempts (newest first) for the profile
// Transactions section. amount getter returns rupees.
export const listSubscriptionPaymentsService = async (userId: mongoose.Types.ObjectId) => {
    const rows = await SubscriptionPayment.find({ userId })
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

// Redeems a promo code: validates it, then grants the plan immediately with no
// payment gateway involved. One redemption per user (unique index); the total
// is capped by maxRedemptions via an atomic guarded $inc.
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

    // Don't let a promo downgrade an active higher tier.
    const user = await User.findById(userId).select('plan planExpiresAt');
    if (!user) throw new AppError('User not found', 404);
    const eff = getEffectivePlan({ plan: user.plan, planExpiresAt: user.planExpiresAt });
    if ((eff.status === 'active' || eff.status === 'grace') && PLAN_RANK[eff.tier] > PLAN_RANK[promo.plan]) {
        throw new AppError(`You're already on the ${eff.tier} plan, which is higher than this code grants.`, 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // Per-user guard: the unique {promoCodeId, userId} index rejects a second
        // redemption (and races safely).
        try {
            await PromoRedemption.create(
                [{ promoCodeId: promo._id, code: promo.code, userId, plan: promo.plan, periodDays: promo.periodDays }],
                { session }
            );
        } catch (e: any) {
            if (e.code === 11000) throw new AppError('You have already redeemed this promo code', 409);
            throw e;
        }

        // Atomic global claim — guards maxRedemptions under concurrency.
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
