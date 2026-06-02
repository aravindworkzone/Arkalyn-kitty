import mongoose , { Document, Schema } from 'mongoose';
import { toDBAmount, fromDBAmount } from '../helpers/Money';

export interface IGroupMember extends Document {
    groupId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    contribution: number;
    role: "SUPER_ADMIN" | "ADMIN" | "MEMBER";
    settlement: boolean;
    settlementAmount: number;
    leaveRequestedAt: Date | null;
    leftMode: "SETTLED" | "FORFEIT" | null;
    isDeleted: boolean;
    isFavorite: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const groupMemberSchema = new Schema<IGroupMember>({
    groupId: {type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true},
    userId: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
    contribution: {type: Number, default: 0, set:toDBAmount, get:fromDBAmount},
    role: {type: String, enum: ["SUPER_ADMIN", "ADMIN", "MEMBER"], default: "MEMBER"},
    settlement: {type: Boolean, default: false},
    // Amount paid out when the member was settled. Stored in display units
    // (no cents conversion) since it is a settlement-time snapshot used only
    // for showing "SETTLED · ₹X" — it never feeds balance arithmetic.
    settlementAmount: {type: Number, default: 0},
    leaveRequestedAt: {type: Date, default: null},
    // Distinguishes how a soft-deleted member exited the group:
    // SETTLED = approval-based path (settlement disbursed),
    // FORFEIT = instant exit with contribution left in the pool.
    leftMode: {type: String, enum: ["SETTLED", "FORFEIT", null], default: null},
    isDeleted: {type: Boolean, default: false},
    isFavorite: {type: Boolean, default: false}
}, {timestamps: true, toJSON: { getters: true }, toObject: { getters: true }});

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
// Hot path: every per-user lookup ("my groups", role checks, ownership counts,
// account/hard delete) filters by userId. The unique index above is prefixed by
// groupId so it can't serve a userId-only query — without this, those become
// collection scans that degrade badly past a few thousand memberships.
groupMemberSchema.index({ userId: 1, isDeleted: 1 });

export default mongoose.model<IGroupMember>("GroupMember", groupMemberSchema);