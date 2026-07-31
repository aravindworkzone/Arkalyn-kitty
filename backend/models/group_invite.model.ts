import mongoose, { Document, Schema } from 'mongoose';
import { toDBAmount, fromDBAmount } from '../helpers/Money';

// Lifecycle: PENDING (sent) → the invitee responds → REJECTED, or
// PENDING_APPROVAL (accepted, awaiting an admin) → ACCEPTED / DECLINED.
// REJECTED is the invitee turning the invite down; DECLINED is an admin
// refusing the join. They are kept apart so the audit trail says who said no.
export type InviteStatus = 'PENDING' | 'PENDING_APPROVAL' | 'ACCEPTED' | 'REJECTED' | 'DECLINED';

export interface IGroupInvite extends Document {
    groupId: mongoose.Types.ObjectId;
    invitedUser: mongoose.Types.ObjectId;
    invitedBy: mongoose.Types.ObjectId;
    status: InviteStatus;
    contribution: number;
    respondedAt?: Date;
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const groupInviteSchema = new Schema<IGroupInvite>(
    {
        groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
        invitedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: {
            type: String,
            enum: ['PENDING', 'PENDING_APPROVAL', 'ACCEPTED', 'REJECTED', 'DECLINED'],
            default: 'PENDING',
        },
        // Declared by the invitee on acceptance, held here until an admin
        // approves — only then does it credit the group balance. Same
        // cents-in-DB / rupees-in-code convention as member contributions.
        contribution: { type: Number, default: 0, set: toDBAmount, get: fromDBAmount },
        // When the invitee accepted or rejected.
        respondedAt: { type: Date, default: null },
        // Which admin approved or declined the join, and when.
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedAt: { type: Date, default: null },
    },
    { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

// A user can only have one outstanding (PENDING) invite per group; they may be
// re-invited after rejecting, so the uniqueness is scoped to PENDING only.
// An invite awaiting admin approval has left this index, so inviteMemberService
// also refuses to re-invite while a PENDING_APPROVAL row exists — the unique
// index on GroupMember is the final backstop against a double join.
groupInviteSchema.index(
    { groupId: 1, invitedUser: 1 },
    { unique: true, partialFilterExpression: { status: 'PENDING' } }
);
groupInviteSchema.index({ invitedUser: 1, status: 1, createdAt: -1 });
// Serves the per-group approval queue.
groupInviteSchema.index({ groupId: 1, status: 1, respondedAt: -1 });

export default mongoose.model<IGroupInvite>('GroupInvite', groupInviteSchema);
