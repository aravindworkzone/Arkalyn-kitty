import mongoose, { Document, Schema } from 'mongoose';
import { type Plan } from '../config/constants';

export interface IPromoRedemption extends Document {
    promoCodeId: mongoose.Types.ObjectId;
    code: string;
    userId: mongoose.Types.ObjectId;
    plan: Plan;
    periodDays: number;
    createdAt?: Date;
}

// One row per (code, user). The unique compound index enforces "one redemption
// per user per code" and races safely under concurrency.
const promoRedemptionSchema = new Schema<IPromoRedemption>(
    {
        promoCodeId: { type: Schema.Types.ObjectId, ref: 'PromoCode', required: true, index: true },
        code: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        plan: { type: String, required: true },
        periodDays: { type: Number, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

promoRedemptionSchema.index({ promoCodeId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IPromoRedemption>('PromoRedemption', promoRedemptionSchema);
