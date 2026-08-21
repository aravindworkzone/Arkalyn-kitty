import mongoose, { Document, Schema } from 'mongoose';
import { toDBAmount, fromDBAmount } from '../helpers/Money';
import { PAYMENT_TYPES, type PaymentType } from './expense.model';

/**
 * What one member owes for one cycle.
 *
 * Every due for every cycle is created when the scheme is activated, so a member
 * can pay ahead, "my history" is a plain indexed query, and nothing has to be
 * lazily materialised on read.
 *
 * MISSED IS NOT A STATUS HERE. It is derived on read — a due is missed when it
 * is still PENDING and either its date has passed or its cycle has already paid
 * out. Storing it would need a scheduled job to flip it, and this codebase has
 * deliberately refused a scheduler for the identical problem (see the lazy plan
 * expiry in helpers/planLimits.ts). services/chit.service.ts owns the one
 * `dueState()` helper that resolves it, so the member view, the organizer view
 * and the history log cannot disagree.
 *
 * A missed due stays payable. "Ravi paid his August dues in September" is the
 * most ordinary event in a real chit, and refusing it would leave the ledger
 * permanently unable to balance.
 */

export const CHIT_DUE_STATUSES = ['PENDING', 'PAID'] as const;
export type ChitDueStatus = typeof CHIT_DUE_STATUSES[number];

// What the server resolves a due to on read. PAID and PENDING are stored; MISSED
// is computed from PENDING plus the clock and the cycle's state.
export const CHIT_DUE_STATES = ['PAID', 'PENDING', 'MISSED'] as const;
export type ChitDueState = typeof CHIT_DUE_STATES[number];

export interface IChitDue extends Document {
    schemeId: mongoose.Types.ObjectId;
    cycleId: mongoose.Types.ObjectId;
    // Denormalised so the defaulter scan and "my history" never need a join.
    groupId: mongoose.Types.ObjectId;
    cycleNumber: number;
    userId: mongoose.Types.ObjectId;
    amount: number;
    status: ChitDueStatus;
    dueDate: Date;
    paidAt: Date | null;
    // How the member actually handed the money over. Reuses the expense model's
    // enum — it is the same question with the same answers, and a chit settled in
    // cash should read the same way an expense paid in cash does.
    paymentType: PaymentType | null;
    // The organizer who recorded it, which is never necessarily the payer.
    recordedBy: mongoose.Types.ObjectId | null;
    /**
     * The CREDIT ledger row this payment produced.
     *
     * The reconciliation invariant: every PAID due points at exactly one
     * non-deleted CREDIT row, and every chit CREDIT row is pointed at by exactly
     * one due. That is what makes the chit page and the group's ledger provably
     * agree rather than merely usually agree, and it is checkable by hand.
     */
    transactionId: mongoose.Types.ObjectId | null;
    isDeleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const chitDueSchema = new Schema<IChitDue>(
    {
        schemeId: { type: Schema.Types.ObjectId, ref: 'ChitScheme', required: true },
        cycleId: { type: Schema.Types.ObjectId, ref: 'ChitCycle', required: true },
        groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
        cycleNumber: { type: Number, required: true, min: 1 },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        amount: { type: Number, required: true, set: toDBAmount, get: fromDBAmount },
        status: { type: String, enum: CHIT_DUE_STATUSES, default: 'PENDING' },
        dueDate: { type: Date, required: true },
        paidAt: { type: Date, default: null },
        paymentType: { type: String, enum: PAYMENT_TYPES, default: null },
        recordedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        transactionId: { type: Schema.Types.ObjectId, ref: 'GroupTransaction', default: null },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

// One due per member per cycle. This is also what makes the mark-as-paid claim
// safe: the service flips PENDING -> PAID with a conditional update, so a
// double-submit finds nothing to claim and cannot double-credit the wallet.
chitDueSchema.index({ cycleId: 1, userId: 1 }, { unique: true });
// The organizer's outstanding/missed scan.
chitDueSchema.index({ groupId: 1, status: 1, dueDate: 1 });
// "My payment history", one member across the scheme.
chitDueSchema.index({ schemeId: 1, userId: 1, cycleNumber: 1 });

export default mongoose.model<IChitDue>('ChitDue', chitDueSchema);
