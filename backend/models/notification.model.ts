import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
    | 'GROUP_INVITE'
    | 'INVITE_ACCEPTED'
    | 'INVITE_REJECTED'
    | 'JOIN_APPROVAL_REQUESTED'
    | 'JOIN_APPROVED'
    | 'JOIN_DECLINED'
    | 'LEAVE_REQUESTED'
    | 'LEAVE_APPROVED'
    | 'LEAVE_REJECTED'
    | 'ROLE_CHANGED'
    | 'MEMBER_LEFT'
    | 'GROUP_DELETED'
    | 'GROUP_LINK_REQUESTED'
    | 'GROUP_LINK_APPROVED'
    | 'GROUP_LINK_REJECTED'
    | 'GROUP_LINK_REVOKED'
    // Credit-line moments: the Reserve set or changed its limit, and a Family
    // group sent it money (repaying what it owes first, any rest deposited).
    | 'GROUP_LINK_CREDIT_LIMIT_SET'
    | 'GROUP_LINK_REPAID'
    // The two chit moments a member actually needs told about: their payment was
    // recorded, and their turn came round.
    | 'CHIT_DUE_RECORDED'
    | 'CHIT_PAYOUT_RELEASED';

export const NOTIFICATION_TYPES: NotificationType[] = [
    'GROUP_INVITE',
    'INVITE_ACCEPTED',
    'INVITE_REJECTED',
    'JOIN_APPROVAL_REQUESTED',
    'JOIN_APPROVED',
    'JOIN_DECLINED',
    'LEAVE_REQUESTED',
    'LEAVE_APPROVED',
    'LEAVE_REJECTED',
    'ROLE_CHANGED',
    'MEMBER_LEFT',
    'GROUP_DELETED',
    'GROUP_LINK_REQUESTED',
    'GROUP_LINK_APPROVED',
    'GROUP_LINK_REJECTED',
    'GROUP_LINK_REVOKED',
    'GROUP_LINK_CREDIT_LIMIT_SET',
    'GROUP_LINK_REPAID',
    'CHIT_DUE_RECORDED',
    'CHIT_PAYOUT_RELEASED',
];

export interface INotification extends Document {
    recipient: mongoose.Types.ObjectId;
    actor: mongoose.Types.ObjectId;
    group: mongoose.Types.ObjectId;
    type: NotificationType;
    metadata: Record<string, unknown>;
    read: boolean;
    createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
        type: { type: String, enum: NOTIFICATION_TYPES, required: true },
        metadata: { type: Schema.Types.Mixed, default: {} },
        read: { type: Boolean, default: false },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 5184000 }); // 60 days

export default mongoose.model<INotification>('Notification', notificationSchema);
