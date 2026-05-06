import mongoose, { Document, Schema } from "mongoose";
import { toDBAmount, fromDBAmount } from "../Helper/Money";

export const TRANSACTION_TYPE = ["CREDIT", "DEBIT", "REFUND"] as const;
export type TransactionType = typeof TRANSACTION_TYPE[number];

export interface IGroupTransaction extends Document {
    groupId: mongoose.Types.ObjectId;
    amount: number;
    action: TransactionType;
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
    amount: { type: Number, required: true, min: 0, set:toDBAmount, get:fromDBAmount },
    action: { type: String, enum: TRANSACTION_TYPE, required: true },
    description: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    referenceModel: { type: String, enum: ["Expense", "Group", "Category", "User"], required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isDeleted: { type: Boolean, default: false }
}, {timestamps: true, toJSON: { getters: true }, toObject: { getters: true }});

export default mongoose.model<IGroupTransaction>("GroupTransaction", groupTransactionSchema);