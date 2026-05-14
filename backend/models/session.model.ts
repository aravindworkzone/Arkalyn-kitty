import mongoose, { Document, Schema } from 'mongoose';

export interface ISession extends Document {
    userId: mongoose.Types.ObjectId;
    refreshToken: string;
    deviceInfo: string;
    createdAt: Date;
    lastUsedAt: Date;
    expiresAt: Date;
}

const sessionSchema = new Schema<ISession>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        refreshToken: { type: String, required: true },
        deviceInfo: { type: String, default: '' },
        lastUsedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ISession>('Session', sessionSchema);
