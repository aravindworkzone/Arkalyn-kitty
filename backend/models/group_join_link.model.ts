import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

/**
 * A shareable "join this group" link.
 *
 * The token is stored in PLAINTEXT, unlike the password-reset token which is
 * sha256'd. That is deliberate: this token is not a credential. It grants the
 * bearer nothing except the right to *ask* — the request lands in the same
 * PENDING_APPROVAL queue an emailed invite does, and an admin still has to
 * approve it before any membership or contribution exists. Hashing it would buy
 * no real safety and would cost the thing admins actually need: being able to
 * re-open the settings page and copy the link again.
 *
 * One active link per group. Rotating deactivates the previous row rather than
 * editing it, so a leaked link can be killed and the history of who created
 * what survives.
 */

export interface IGroupJoinLink extends Document {
    groupId: mongoose.Types.ObjectId;
    token: string;
    createdBy: mongoose.Types.ObjectId;
    isActive: boolean;
    expiresAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

// 24 random bytes -> 32 url-safe chars, the same 192 bits of entropy the
// personal API key uses. Long enough that guessing is not a threat model.
export const generateJoinToken = (): string => crypto.randomBytes(24).toString('base64url');

const groupJoinLinkSchema = new Schema<IGroupJoinLink>(
    {
        groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
        token: { type: String, required: true, unique: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        isActive: { type: Boolean, default: true },
        // Null means it never expires. Rotation and revocation are the primary
        // controls; expiry is here for links shared somewhere public.
        expiresAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// At most one live link per group.
groupJoinLinkSchema.index(
    { groupId: 1 },
    { unique: true, partialFilterExpression: { isActive: true } }
);

export default mongoose.model<IGroupJoinLink>('GroupJoinLink', groupJoinLinkSchema);
