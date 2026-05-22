import mongoose, { Document, Schema } from 'mongoose';

export interface IPasswordReset extends Document {
    userId: mongoose.Types.ObjectId;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
}

// One-time password-reset tokens. Only the SHA-256 hash of the token is stored;
// the raw token lives only in the emailed link. The TTL index lets MongoDB
// auto-purge expired docs so stale tokens never accumulate.
const passwordResetSchema = new Schema<IPasswordReset>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        tokenHash: { type: String, required: true, index: true },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IPasswordReset>('PasswordReset', passwordResetSchema);
