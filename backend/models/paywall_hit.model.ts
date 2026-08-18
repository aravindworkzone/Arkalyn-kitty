import mongoose, { Document, Schema } from 'mongoose';
import type { Plan } from '../config/constants';

/**
 * Every time the app tells someone "your plan doesn't allow that", we write it
 * down.
 *
 * This is the highest-signal data the product generates and it was previously
 * thrown away with the 402 response. A paywall hit is a customer stating, with
 * their hands rather than a survey, exactly which capability they wanted badly
 * enough to walk into a wall for — which is the only sound basis for deciding
 * what to price, what to move between tiers, and what to build next.
 *
 * Recorded centrally in middlewares/error.middleware, so it captures every 402
 * in the app including gates added later, with no per-call-site bookkeeping.
 */

export interface IPaywallHit extends Document {
    groupId: mongoose.Types.ObjectId | null;
    userId: mongoose.Types.ObjectId | null;
    // The tier the group was on when it hit the wall — the "from" side of any
    // upgrade this eventually causes.
    tier: Plan;
    // Normalised gate identity, e.g. `POST /api/grouplink/request`. The route,
    // not the message: messages get reworded and would fragment the grouping.
    gate: string;
    message: string;
    createdAt: Date;
}

const paywallHitSchema = new Schema<IPaywallHit>(
    {
        // Nullable because a few 402s can fire before a group is resolved; the
        // row is still worth keeping for the gate-level count.
        groupId: { type: Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
        tier: { type: String, default: 'FREE' },
        gate: { type: String, required: true, index: true },
        message: { type: String, default: '' },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Serves the "what is blocking people this month" query directly.
paywallHitSchema.index({ createdAt: -1, gate: 1 });

// Two years. Long enough to compare this year's audit season against last
// year's, short enough that a behavioural log doesn't accumulate forever.
paywallHitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });

export default mongoose.model<IPaywallHit>('PaywallHit', paywallHitSchema);
