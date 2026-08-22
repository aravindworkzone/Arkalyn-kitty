import mongoose, { Document, Schema } from 'mongoose';

/**
 * One browser's push endpoint. A user has as many of these as they have
 * browsers/devices, so lookups are by `userId` and always return a list.
 *
 * The endpoint is the identity: it is the URL the push service hands out, and it
 * already identifies exactly one browser install. Keying on it (rather than on
 * user+endpoint) is what lets a re-subscribe upsert cleanly, including the case
 * where a second account signs in on a browser that is already subscribed — the
 * endpoint is reassigned to whoever holds it now instead of quietly delivering
 * that person's notifications to the previous account.
 */
export interface IPushSubscription extends Document {
    userId: mongoose.Types.ObjectId;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    createdAt: Date;
    updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        endpoint: { type: String, required: true, unique: true },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true },
        },
    },
    { timestamps: true }
);

export default mongoose.model<IPushSubscription>('PushSubscription', pushSubscriptionSchema);
