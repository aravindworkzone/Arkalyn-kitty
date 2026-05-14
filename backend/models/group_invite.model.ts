import mongoose, { Document, Schema } from 'mongoose';

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface IGroupInvite extends Document {
    groupId: mongoose.Types.ObjectId;
    invitedUser: mongoose.Types.ObjectId;
    invitedBy: mongoose.Types.ObjectId;
    status: InviteStatus;
    respondedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const groupInviteSchema = new Schema<IGroupInvite>(
    {
        groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
        invitedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' },
        respondedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// A user can only have one outstanding (PENDING) invite per group; they may be
// re-invited after rejecting, so the uniqueness is scoped to PENDING only.
groupInviteSchema.index(
    { groupId: 1, invitedUser: 1 },
    { unique: true, partialFilterExpression: { status: 'PENDING' } }
);
groupInviteSchema.index({ invitedUser: 1, status: 1, createdAt: -1 });

export default mongoose.model<IGroupInvite>('GroupInvite', groupInviteSchema);
