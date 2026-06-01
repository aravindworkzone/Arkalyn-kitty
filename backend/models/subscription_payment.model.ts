import mongoose, { Document, Schema } from 'mongoose';
import { toDBAmount, fromDBAmount } from '../helpers/Money';
import { PLAN_TIERS, BILLING_CYCLES, type Plan, type BillingCycle } from '../config/constants';

export type PaymentStatus = 'created' | 'paid' | 'failed';

export interface ISubscriptionPayment extends Document {
    userId: mongoose.Types.ObjectId;
    plan: Plan;
    cycle: BillingCycle;
    amount: number; // rupees in/out (stored as integer paise via setter)
    periodDays: number;
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    status: PaymentStatus;
    createdAt?: Date;
    updatedAt?: Date;
}

// One document per checkout attempt. `razorpayOrderId` is unique and doubles as
// the idempotency key: the created -> paid transition is an atomic
// findOneAndUpdate, so a payment can only ever be granted once even if both the
// browser callback and the webhook fire.
const subscriptionPaymentSchema = new Schema<ISubscriptionPayment>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        plan: { type: String, enum: PLAN_TIERS, required: true },
        cycle: { type: String, enum: BILLING_CYCLES, required: true },
        amount: { type: Number, required: true, min: 0, set: toDBAmount, get: fromDBAmount },
        periodDays: { type: Number, required: true },
        razorpayOrderId: { type: String, required: true, unique: true },
        razorpayPaymentId: { type: String },
        status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created', index: true },
    },
    { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

export default mongoose.model<ISubscriptionPayment>('SubscriptionPayment', subscriptionPaymentSchema);
