import mongoose, { Document, Schema } from 'mongoose';

interface IGroupEvent extends Document {
    groupId: mongoose.Types.ObjectId;
    performedBy: mongoose.Types.ObjectId;
    eventType: string;
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
    eventType: { type: String, enum: ["MANAGE_MEMBER", "MANAGE_CATEGORY", "CHANGE_ROLE", "CREATE_GROUP"], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    referenceModel: { type: String, enum: ["Expense", "Group", "Category"], default: null },
    amount: { type: Number , default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

groupEventSchema.index({ groupId: 1, createdAt: -1 });
groupEventSchema.index({ groupId: 1, eventType: 1 });

export default mongoose.model<IGroupEvent>("GroupEvent", groupEventSchema);
