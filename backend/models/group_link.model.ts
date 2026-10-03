import mongoose, { Document, Schema } from 'mongoose';
import { toDBAmount, fromDBAmount } from '../helpers/Money';

// A funding link between two groups: the SOURCE bankrolls the HOST.
//
// Lifecycle mirrors GroupInvite's two-step consent: an admin of the host asks
// (PENDING), then an admin of the source answers — ACTIVE or REJECTED. REVOKED
// is a link that was live and got torn down afterwards, kept distinct from
// REJECTED so the audit trail records whether money ever actually moved.
//
// The link is a CREDIT LINE, like a card: the source (a Reserve) sets a limit,
// the host (a Family group) spends against it at expense time, and what it has
// spent is `outstanding` until the host repays it. See
// services/groupLink.service.ts.
export type GroupLinkStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED';

export interface IGroupLink extends Document {
    hostGroupId: mongoose.Types.ObjectId;
    sourceGroupId: mongoose.Types.ObjectId;
    status: GroupLinkStatus;
    contribution: number;
    creditLimit: number;
    outstanding: number;
    requestedBy: mongoose.Types.ObjectId;
    reviewedBy?: mongoose.Types.ObjectId | null;
    reviewedAt?: Date | null;
    isDeleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const groupLinkSchema = new Schema<IGroupLink>(
    {
        // The group that receives the money and files the expenses.
        hostGroupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
        // The group the money comes out of.
        sourceGroupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
        status: {
            type: String,
            enum: ['PENDING', 'ACTIVE', 'REJECTED', 'REVOKED'],
            default: 'PENDING',
        },
        // Lump sums the source pushed in under the old gift model. Frozen history:
        // never owed back, and nothing writes it any more.
        // Same cents-in-DB / rupees-in-code convention as member contributions,
        // so every write goes through raw rupees and the setter converts.
        contribution: { type: Number, default: 0, set: toDBAmount, get: fromDBAmount },
        // The most the host may owe at once. Set by a source admin; 0 means the
        // host cannot draw yet.
        creditLimit: { type: Number, default: 0, min: 0, set: toDBAmount, get: fromDBAmount },
        // What the host currently owes: credit drawn by expenses, minus repayments.
        outstanding: { type: Number, default: 0, min: 0, set: toDBAmount, get: fromDBAmount },
        // An admin of the host, who asked for the link.
        requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        // The admin of the source who approved or rejected it, and when.
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedAt: { type: Date, default: null },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

// One outstanding request per ordered pair — a link may be re-requested after a
// rejection, so uniqueness is scoped to PENDING only (same reasoning as the
// GroupInvite index).
groupLinkSchema.index(
    { hostGroupId: 1, sourceGroupId: 1 },
    { unique: true, partialFilterExpression: { status: 'PENDING' } }
);
// ...and one live link per ordered pair. A revoked link leaves this index, so
// the pair can be linked again later.
groupLinkSchema.index(
    { hostGroupId: 1, sourceGroupId: 1 },
    { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);
// Serves the source group's approval queue and its outgoing-links list.
groupLinkSchema.index({ sourceGroupId: 1, status: 1, createdAt: -1 });
// Serves the host group's incoming-links list.
groupLinkSchema.index({ hostGroupId: 1, status: 1, createdAt: -1 });

export default mongoose.model<IGroupLink>('GroupLink', groupLinkSchema);
