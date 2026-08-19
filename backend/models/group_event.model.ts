import mongoose, { Document, Schema } from 'mongoose';
import { toDBAmount, fromDBAmount } from '../helpers/Money';

interface IGroupEvent extends Document {
    groupId: mongoose.Types.ObjectId;
    performedBy: mongoose.Types.ObjectId;
    eventType: "MEMBER_ADDED" | "MEMBER_REMOVED" | "MANAGE_CATEGORY" | "CHANGE_ROLE" | "CREATE_GROUP" | "GROUP_CLOSED" | "CREDIT_REMOVED" | "EXPENSE_EDITED" | "GROUP_LINK_UPDATED" | "GROUP_LINK_TRANSFER" | "CHIT_UPDATED" | "CHIT_PAYOUT";
    referenceId?: mongoose.Types.ObjectId;
    referenceModel?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
    isDeleted: boolean;
}

const groupEventSchema = new Schema<IGroupEvent>({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // CHIT_UPDATED carries the scheme lifecycle (created / activated / rescheduled /
    // cancelled) with the specific action in metadata, the way GROUP_LINK_UPDATED
    // does. CHIT_PAYOUT is separate because money moved, matching the
    // GROUP_LINK_TRANSFER precedent.
    eventType: { type: String, enum: ["MEMBER_ADDED", "MEMBER_REMOVED", "MANAGE_CATEGORY", "CHANGE_ROLE", "CREATE_GROUP", "GROUP_CLOSED", "CREDIT_REMOVED", "EXPENSE_EDITED", "GROUP_LINK_UPDATED", "GROUP_LINK_TRANSFER", "CHIT_UPDATED", "CHIT_PAYOUT"], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, refPath: "referenceModel", default: null },
    referenceModel: { type: String, enum: ["Expense", "Group", "Category", "User"], default: null },
    amount: { type: Number , default: null, set:toDBAmount, get:fromDBAmount },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isDeleted: { type: Boolean, default: false }
}, {timestamps: true, toJSON: { getters: true }, toObject: { getters: true }});

groupEventSchema.index({ groupId: 1, createdAt: -1 });
groupEventSchema.index({ groupId: 1, eventType: 1 });

export default mongoose.model<IGroupEvent>("GroupEvent", groupEventSchema);
