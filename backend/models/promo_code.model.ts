import mongoose, { Document, Schema } from 'mongoose';
import { PLAN_TIERS, BILLING_CYCLES, type Plan, type BillingCycle } from '../config/constants';

export interface IPromoCode extends Document {
    code: string; // stored uppercase
    plan: Plan; // tier this code grants (never FREE)
    cycle: BillingCycle; // monthly/yearly — display + granted planCycle
    periodDays: number; // how long the grant lasts
    maxRedemptions: number | null; // null = unlimited total redemptions
    redemptionCount: number; // total times redeemed (across all users)
    expiresAt: Date | null; // when the code itself stops working
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

// Promo codes grant a plan for free, bypassing the payment gateway. One
// redemption per user (enforced by the unique index on PromoRedemption);
// `maxRedemptions` caps the total across all users. Codes are created directly
// in the DB (no admin UI yet), e.g.:
//   db.promocodes.insertOne({ code: "LAUNCH2026", plan: "PRO", periodDays: 365,
//     maxRedemptions: 100, redemptionCount: 0, expiresAt: null, isActive: true })
const promoCodeSchema = new Schema<IPromoCode>(
    {
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        plan: { type: String, enum: PLAN_TIERS, required: true },
        cycle: { type: String, enum: BILLING_CYCLES, required: true },
        periodDays: { type: Number, required: true, min: 1 },
        maxRedemptions: { type: Number, default: null },
        redemptionCount: { type: Number, default: 0 },
        expiresAt: { type: Date, default: null },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export default mongoose.model<IPromoCode>('PromoCode', promoCodeSchema);
