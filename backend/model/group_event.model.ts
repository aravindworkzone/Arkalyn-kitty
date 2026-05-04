import mongoose, { Document, Schema } from 'mongoose';
import { toDBAmount, fromDBAmount } from '../Helper/Money';

interface IGroupEvent extends Document {
    groupId: mongoose.Types.ObjectId;
    performedBy: mongoose.Types.ObjectId;
    eventType: "MEMBER_ADDED" | "MEMBER_REMOVED" | "MANAGE_CATEGORY" | "CHANGE_ROLE" | "CREATE_GROUP";
    referenceId?: mongoose.Types.ObjectId;
    referenceModel?: string;
    amount?: number;
    metadata?: Record<string, any>;
    createdAt?: Date;
    updatedAt?: Date;
    isDeleted: boolean;
}

const groupEventSchema = new Schema<IGroupEvent>({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    eventType: { type: String, enum: ["MEMBER_ADDED", "MEMBER_REMOVED", "MANAGE_CATEGORY", "CHANGE_ROLE", "CREATE_GROUP"], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, refPath: "referenceModel", default: null },
    referenceModel: { type: String, enum: ["Expense", "Group", "Category"], default: null },
    amount: { type: Number , default: null, set:toDBAmount, get:fromDBAmount },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isDeleted: { type: Boolean, default: false }
}, {timestamps: true, toJSON: { getters: true }, toObject: { getters: true }});

groupEventSchema.index({ groupId: 1, createdAt: -1 });
groupEventSchema.index({ groupId: 1, eventType: 1 });

export default mongoose.model<IGroupEvent>("GroupEvent", groupEventSchema);
