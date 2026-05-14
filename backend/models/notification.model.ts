import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
    | 'GROUP_INVITE'
    | 'INVITE_ACCEPTED'
    | 'INVITE_REJECTED'
    | 'LEAVE_REQUESTED'
    | 'LEAVE_APPROVED'
    | 'LEAVE_REJECTED'
    | 'ROLE_CHANGED'
    | 'MEMBER_LEFT'
    | 'GROUP_DELETED';

export const NOTIFICATION_TYPES: NotificationType[] = [
    'GROUP_INVITE',
    'INVITE_ACCEPTED',
    'INVITE_REJECTED',
    'LEAVE_REQUESTED',
    'LEAVE_APPROVED',
    'LEAVE_REJECTED',
    'ROLE_CHANGED',
    'MEMBER_LEFT',
    'GROUP_DELETED',
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
