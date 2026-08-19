import mongoose, { Document, Schema } from 'mongoose';
import { toDBAmount, fromDBAmount } from '../helpers/Money';

/**
 * One cycle of a chit scheme: everyone contributes, one member takes the pot.
 *
 * Every cycle is created up front when the scheme is activated, with its date
 * derived from `startDate + cycleIntervalDays × (n - 1)`. There is no per-cycle
 * "open" step for the organizer to remember, members can pay ahead, and the
 * current cycle is simply the lowest-numbered one not yet PAID.
 *
 * There is no CANCELLED status here. Cancelling happens at the scheme level and
 * stops everything at once; a single cancelled cycle would leave its recipient's
 * turn in an undefined place in the rotation, which is a rule nobody has needed.
 */

export const CHIT_CYCLE_STATUSES = ['COLLECTING', 'PAID'] as const;
export type ChitCycleStatus = typeof CHIT_CYCLE_STATUSES[number];

export interface IChitCycle extends Document {
    schemeId: mongoose.Types.ObjectId;
    // Denormalised from the scheme: every query here is group-scoped, and
    // carrying it avoids a join on the hot read.
    groupId: mongoose.Types.ObjectId;
    cycleNumber: number;
    status: ChitCycleStatus;
    // Copied from the scheme's participant at this position when the cycle is
    // created, rather than read back through the order at display time. Stored
    // because it is a historical fact: the history log must stay truthful about
    // who actually got paid.
    recipientUserId: mongoose.Types.ObjectId;
    // amountPerMember × participant count. Everyone pays every cycle, the
    // recipient included, so this never varies across the scheme.
    expectedAmount: number;
    // Running total, $inc'd as each contribution is recorded. May keep rising
    // after the payout: a late contribution is still a real contribution.
    collectedAmount: number;
    // What the recipient actually received. Zero until the payout is released.
    payoutAmount: number;
    // expected − collected, frozen at the moment of payout.
    //
    // NOT recalculated when someone pays late. It records what the recipient got
    // on the day, which is a fact about that day and never changes afterwards —
    // whereas collectedAmount records what the group eventually gathered. The two
    // are allowed to disagree, and the gap between them is the point.
    shortfallAmount: number;
    dueDate: Date;
    paidAt: Date | null;
    paidBy: mongoose.Types.ObjectId | null;
    isDeleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const chitCycleSchema = new Schema<IChitCycle>(
    {
        schemeId: { type: Schema.Types.ObjectId, ref: 'ChitScheme', required: true },
        groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
        cycleNumber: { type: Number, required: true, min: 1 },
        status: { type: String, enum: CHIT_CYCLE_STATUSES, default: 'COLLECTING' },
        recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        expectedAmount: { type: Number, required: true, set: toDBAmount, get: fromDBAmount },
        collectedAmount: { type: Number, default: 0, set: toDBAmount, get: fromDBAmount },
        payoutAmount: { type: Number, default: 0, set: toDBAmount, get: fromDBAmount },
        shortfallAmount: { type: Number, default: 0, set: toDBAmount, get: fromDBAmount },
        dueDate: { type: Date, required: true },
        paidAt: { type: Date, default: null },
        paidBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

// One row per cycle number per scheme.
chitCycleSchema.index({ schemeId: 1, cycleNumber: 1 }, { unique: true });
// Serves "the current cycle" and the history list.
chitCycleSchema.index({ groupId: 1, status: 1, cycleNumber: 1 });
// A member cannot take two turns. The order already guarantees it, but the order
// is application logic and this is the database saying so.
chitCycleSchema.index({ schemeId: 1, recipientUserId: 1 }, { unique: true });

export default mongoose.model<IChitCycle>('ChitCycle', chitCycleSchema);
