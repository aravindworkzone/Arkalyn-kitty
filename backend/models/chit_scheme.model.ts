import mongoose, { Document, Schema } from 'mongoose';
import { toDBAmount, fromDBAmount } from '../helpers/Money';

/**
 * A chit fund running inside a group.
 *
 * The simple rotating-savings kind: every participant pays `amountPerMember`
 * each cycle, and one participant per cycle receives the whole pot, in an order
 * fixed when the scheme is activated. There is no auction, no bidding, no
 * discount and no organizer commission — so the pot is always
 * `amountPerMember × participants.length`, and over the full term each member
 * pays in exactly what they take out. That symmetry is what makes it a chit
 * rather than a lottery, and it is why the recipient still pays their own
 * contribution in the cycle they receive.
 *
 * The money is the GROUP's money. A contribution credits the group wallet and a
 * payout debits it, through the same helpers/balanceOps every other money path
 * uses — there is no parallel chit ledger. See services/chit.service.ts.
 */

export const CHIT_SCHEME_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type ChitSchemeStatus = typeof CHIT_SCHEME_STATUSES[number];

/**
 * Hard ceiling on participants, and therefore on cycles.
 *
 * An anti-abuse bound rather than a billing lever — the plan's
 * `maxMembersPerGroup` is the billing one, checked separately. This exists
 * because activation materialises every cycle AND every due in a single
 * transaction, which is N² documents: 50 participants is 2,500 rows, which is
 * comfortable, and nothing above it is a real chit.
 */
export const MAX_CHIT_PARTICIPANTS = 50;

export interface IChitParticipant {
    userId: mongoose.Types.ObjectId;
    // 1..N. Also the cycle number in which this member receives the pot, which is
    // what lets every member be told their payout date up front.
    position: number;
}

export interface IChitScheme extends Document {
    groupId: mongoose.Types.ObjectId;
    status: ChitSchemeStatus;
    // What each participant owes per cycle.
    amountPerMember: number;
    // Always equal to participants.length — a chit gives every member exactly one
    // turn. Stored rather than derived so a cycle row can be validated against it
    // without loading the participant array.
    totalCycles: number;
    startDate: Date;
    cycleIntervalDays: number;
    // Days after a cycle's start that its contributions are still on time. Past
    // that an unpaid due reads as missed.
    dueDays: number;
    // The only person who may record payments and release payouts, besides the
    // group's SUPER_ADMIN. Deliberately NOT a role check: on the Free plan every
    // member of a group is an ADMIN, so gating on the role would let anyone mark
    // themselves paid and pay themselves the pot.
    organizerUserId: mongoose.Types.ObjectId;
    // Frozen at activation. The order is the scheme's promise to its members, so
    // it cannot move once anyone has paid against it.
    participants: IChitParticipant[];
    activatedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    cancelledReason: string | null;
    createdBy: mongoose.Types.ObjectId;
    isDeleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const chitParticipantSchema = new Schema<IChitParticipant>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        position: { type: Number, required: true, min: 1 },
    },
    { _id: false }
);

const chitSchemeSchema = new Schema<IChitScheme>(
    {
        groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
        status: { type: String, enum: CHIT_SCHEME_STATUSES, default: 'DRAFT' },
        // Cents in the DB, rupees in application code — the schema boundary is
        // the only place that converts. See helpers/Money.
        amountPerMember: { type: Number, required: true, set: toDBAmount, get: fromDBAmount },
        totalCycles: { type: Number, required: true, min: 1, max: MAX_CHIT_PARTICIPANTS },
        startDate: { type: Date, required: true },
        cycleIntervalDays: { type: Number, default: 30, min: 1, max: 365 },
        dueDays: { type: Number, default: 10, min: 0, max: 365 },
        organizerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        participants: { type: [chitParticipantSchema], default: [] },
        activatedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },
        cancelledReason: { type: String, default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

// One live scheme per group. Scoped to the two open states so a group can run a
// second chit once the first has completed or been cancelled — which a committee
// running an annual scheme will want, and which this index allows with no
// migration. DRAFT and ACTIVE are listed explicitly rather than excluding the
// closed ones, because $ne/$nin are not portably supported in partial filters.
chitSchemeSchema.index(
    { groupId: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['DRAFT', 'ACTIVE'] } } }
);
chitSchemeSchema.index({ groupId: 1, status: 1, createdAt: -1 });

export default mongoose.model<IChitScheme>('ChitScheme', chitSchemeSchema);
