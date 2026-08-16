import mongoose, { Document, Schema } from 'mongoose';
import { type Plan } from '../config/constants';

export interface IPromoRedemption extends Document {
    promoCodeId: mongoose.Types.ObjectId;
    code: string;
    // The group that received the grant — the unit a code is spent on.
    groupId: mongoose.Types.ObjectId;
    // Who redeemed it, for audit only.
    userId: mongoose.Types.ObjectId;
    plan: Plan;
    periodDays: number;
    createdAt?: Date;
}

// One row per (code, group). The unique compound index enforces "one redemption
// per group per code" and races safely under concurrency. Scoped to the group
// rather than the redeemer because the grant lands on the group: without this a
// second admin could re-spend the same code on the group they share.
const promoRedemptionSchema = new Schema<IPromoRedemption>(
    {
        promoCodeId: { type: Schema.Types.ObjectId, ref: 'PromoCode', required: true, index: true },
        code: { type: String, required: true },
        groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        plan: { type: String, required: true },
        periodDays: { type: Number, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

promoRedemptionSchema.index({ promoCodeId: 1, groupId: 1 }, { unique: true });

export default mongoose.model<IPromoRedemption>('PromoRedemption', promoRedemptionSchema);
