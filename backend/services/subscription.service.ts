import mongoose from 'mongoose';
import Group from '../models/group.model';
import SubscriptionPayment from '../models/subscription_payment.model';
import PromoCode from '../models/promo_code.model';
import PromoRedemption from '../models/promo_redemption.model';
import { AppError } from '../helpers/AppError';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { toDBAmount } from '../helpers/Money';
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature, getFullRazorpayDetails, refundPayment, isRazorpayConfigured } from '../utils/razorpay';
import { getEffectivePlan, toPlanView } from '../helpers/planLimits';
import {
    PLANS,
    PLAN_RANK,
    BILLING_PERIOD_DAYS,
    SELLABLE_TIERS,
    isSellablePlan,
    type Plan,
    type BillingCycle,
} from '../config/constants';

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

// Writes a grant onto the group with a targeted $set. Deliberately not
// doc.save(): `balance` and `totalContribution` carry rupee<->paise
// setters/getters, and a whole-document write is the one place a stray
// re-conversion could corrupt the pool. Only the four plan paths are touched.
const applyGrantToGroup = async (
    groupId: mongoose.Types.ObjectId,
    plan: Plan,
    cycle: BillingCycle,
    periodDays: number,
    source: 'PAYMENT' | 'PROMO',
    session?: mongoose.ClientSession
) => {
    const group = await Group.findById(groupId)
        .select('plan planExpiresAt')
        .session(session ?? null);
    if (!group) throw new AppError('Group not found', 404);

    const planExpiresAt = computeGrantExpiry(group.plan, group.planExpiresAt, plan, periodDays);

    await Group.updateOne(
        { _id: groupId },
        { $set: { plan, planExpiresAt, planCycle: cycle, planSource: source } },
        { session }
    );

    return getEffectivePlan({ plan, planExpiresAt });
};

// The catalogue, plus whether checkout can actually run. Razorpay keys are
// optional infrastructure (utils/razorpay.ts degrades to a 503), so without this
// flag the UI can only discover payments are off by taking the user through a
// checkout that then fails. Promo redemption never touches the gateway, so it
// stays available either way — which is what the UI steers to.
// `plans` still carries every tier, legacy PREMIUM included, so a group sitting
// on one can render its own entitlements. `sellable` is the ordered list the
// pricing table draws — the UI must not infer purchasability from the catalogue
// keys, or a retired tier reappears on the checkout page.
export const getPlansService = () => ({
    plans: PLANS,
    sellable: SELLABLE_TIERS,
    paymentsEnabled: isRazorpayConfigured,
});

// Opens a checkout for ONE group. Role is enforced upstream (loadGroup +
// authorizeRole), so reaching here means the caller administers the group; the
// tier comparison below is against the GROUP's current entitlement, not the
// buyer's — a Premium group can't be knocked down to Pro by a second admin, and
// nothing about the buyer's other groups is relevant.
export const createSubscriptionOrderService = async (
    userId: mongoose.Types.ObjectId,
    groupId: mongoose.Types.ObjectId | string,
    plan: Plan,
    cycle: BillingCycle
) => {
    if (plan === 'FREE') throw new AppError('The Free plan does not require payment', 400);
    // Defence in depth behind the validator's enum: promo grants, admin
    // overrides and the MCP surface all reach plan values from other routes, and
    // a retired tier must never be reachable by checkout from any of them.
    if (!isSellablePlan(plan)) {
        throw new AppError(
            `The ${PLANS[plan].name} plan is no longer sold. Choose ${SELLABLE_TIERS.filter((t) => t !== 'FREE').join(' or ')}.`,
            400
        );
    }

    const group = await Group.findById(groupId).select('plan planExpiresAt status name');
    if (!group) throw new AppError('Group not found', 404);
    if (group.status === 'CLOSED') {
        throw new AppError('This group is closed — its plan is frozen and cannot be changed.', 400);
    }

    const eff = getEffectivePlan({ plan: group.plan, planExpiresAt: group.planExpiresAt });
    if ((eff.status === 'active' || eff.status === 'grace') && PLAN_RANK[eff.tier] > PLAN_RANK[plan]) {
        throw new AppError(
            `This group is on the ${PLANS[eff.tier].name} plan; downgrading it to ${PLANS[plan].name} isn't allowed while that's active.`,
            400
        );
    }

    const config = PLANS[plan];
    const priceRupees = cycle === 'yearly' ? config.priceYearly : config.priceMonthly;
    if (!priceRupees || priceRupees <= 0) throw new AppError('Invalid plan price', 400);

    const periodDays = BILLING_PERIOD_DAYS[cycle];
    const amountPaise = toDBAmount(priceRupees);

    const order = await createRazorpayOrder({
        amountPaise,
        receipt: `sub_${group._id.toString().slice(-10)}_${Date.now().toString(36)}`,
        notes: { groupId: group._id.toString(), userId: userId.toString(), plan, cycle },
    });

    await SubscriptionPayment.create({
        groupId: group._id,
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
        groupId: group._id.toString(),
        groupName: group.name,
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
        const g = await Group.findById(existing.groupId).select('plan planExpiresAt');
        return getEffectivePlan({ plan: g?.plan, planExpiresAt: g?.planExpiresAt });
    }

    return applyGrantToGroup(
        payment.groupId,
        payment.plan,
        payment.cycle,
        payment.periodDays,
        'PAYMENT'
    );
};

// Refunds a captured payment that can't be turned into a plan grant. Never
// throws: callers refuse the grant regardless of whether the refund succeeds.
// The created/failed -> refunded transition is an atomic findOneAndUpdate on the
// unique razorpayOrderId, mirroring grantFromPayment's claim, so the browser
// callback and the webhook can't both issue a refund for the same payment.
const refundCapturedPayment = async (
    razorpayOrderId: string,
    razorpayPaymentId: string,
    reason: string
): Promise<void> => {
    const claimed = await SubscriptionPayment.findOneAndUpdate(
        { razorpayOrderId, status: { $in: ['created', 'failed'] } },
        { status: 'refunded', razorpayPaymentId },
        { new: false }
    );
    if (!claimed) return;

    try {
        const refund = await refundPayment(razorpayPaymentId);
        await SubscriptionPayment.updateOne({ razorpayOrderId }, { razorpayRefundId: refund.id });
        logger.warn({ razorpayOrderId, razorpayPaymentId, reason }, 'Refunded ungranted subscription payment');
    } catch (err) {
        // Refund call failed — undo the claim so the doc isn't stuck as 'refunded'
        // with no actual refund, letting a retry or manual op try again.
        await SubscriptionPayment.updateOne(
            { razorpayOrderId, status: 'refunded' },
            { status: claimed.status }
        );
        logger.error({ err, razorpayOrderId, razorpayPaymentId, reason }, 'Refund of ungranted subscription payment failed');
    }
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
        // Money settled but we won't grant the plan — refund it. An authorized
        // (not yet captured) payment has taken nothing, so leave it to expire.
        if (razorpay_payment.status === 'captured') {
            await refundCapturedPayment(data.razorpay_order_id, data.razorpay_payment_id, 'amount mismatch');
        }
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
                    // payment.captured event: the money is settled, so refund it
                    // rather than silently keeping a payment we won't honour.
                    await refundCapturedPayment(entity.order_id, entity.id, 'webhook amount mismatch');
                    return;
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

// Receipts for checkouts THIS user paid for, across every group they bought a
// plan for. Scoped by payer rather than by group: it's their money and their
// billing history, even for a group they have since left.
export const listSubscriptionPaymentsService = async (userId: mongoose.Types.ObjectId) => {
    const rows = await SubscriptionPayment.find({ userId, isDeleted: { $ne: true } })
        .populate<{ groupId: { _id: mongoose.Types.ObjectId; name: string; displayId: string } | null }>(
            'groupId',
            'name displayId'
        )
        .sort({ createdAt: -1 })
        .limit(50);
    return rows.map((r) => ({
        id: r._id.toString(),
        // Null only if the group was hard-deleted after the payment; the receipt
        // itself still stands.
        group: r.groupId
            ? { id: r.groupId._id.toString(), name: r.groupId.name, displayId: r.groupId.displayId }
            : null,
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

// Redeems a code FOR a group. Role is enforced upstream, same as checkout.
export const redeemPromoCodeService = async (
    userId: mongoose.Types.ObjectId,
    groupId: mongoose.Types.ObjectId | string,
    codeRaw: string
) => {
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

    const group = await Group.findById(groupId).select('plan planExpiresAt status');
    if (!group) throw new AppError('Group not found', 404);
    if (group.status === 'CLOSED') {
        throw new AppError('This group is closed — its plan is frozen and cannot be changed.', 400);
    }
    const eff = getEffectivePlan({ plan: group.plan, planExpiresAt: group.planExpiresAt });
    if ((eff.status === 'active' || eff.status === 'grace') && PLAN_RANK[eff.tier] > PLAN_RANK[promo.plan]) {
        throw new AppError(`This group is already on the ${PLANS[eff.tier].name} plan, which is higher than this code grants.`, 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        try {
            await PromoRedemption.create(
                [{ promoCodeId: promo._id, code: promo.code, groupId: group._id, userId, plan: promo.plan, periodDays: promo.periodDays }],
                { session }
            );
        } catch (e: any) {
            if (e.code === 11000) throw new AppError('This promo code has already been used on this group', 409);
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

        const granted = await applyGrantToGroup(
            group._id as mongoose.Types.ObjectId,
            promo.plan,
            promo.cycle,
            promo.periodDays,
            'PROMO',
            session
        );

        await session.commitTransaction();
        return toPlanView(granted);
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};
