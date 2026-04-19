import mongoose, { Document, Schema } from "mongoose";

export interface IGroupTransaction extends Document {
    groupId: mongoose.Types.ObjectId;
    amount: number;
    action: "CREDIT" | "DEBIT" | "REFUND";
    description: string;
    referenceId: mongoose.Types.ObjectId;
    performedBy: mongoose.Types.ObjectId;
    referenceModel: string;
    metadata?: Record<string, any>;
    isDeleted?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const groupTransactionSchema = new Schema<IGroupTransaction>({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    amount: { type: Number, required: true, min: 1 },
    action: { type: String, enum: ["CREDIT", "DEBIT", "REFUND"], required: true },
    description: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    referenceModel: { type: String, enum: ["Expense", "Group"], required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model<IGroupTransaction>("GroupTransaction", groupTransactionSchema);