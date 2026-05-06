export const PAYMENT_TYPES = ["Cash", "Card", "UPI", "Net Banking"] as const;
export type PaymentType = typeof PAYMENT_TYPES[number];

import mongoose, { Document, Schema} from "mongoose";
import { toDBAmount, fromDBAmount } from "../Helper/Money";

export interface IExpense extends Document {
    groupId: mongoose.Types.ObjectId;
    category: mongoose.Types.ObjectId;
    title: string;
    amount: number;
    splitBetween: {
        userId: mongoose.Types.ObjectId;
        amount: number;
    }[];
    paidBy: mongoose.Types.ObjectId;
    paymentType: PaymentType;
    isDeleted: boolean;
    date: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

const expenseSchema = new Schema<IExpense>({
    groupId: {type: mongoose.Types.ObjectId, ref: "Group", required: true},
    category: {type: mongoose.Types.ObjectId, ref: "Category", required: true},
    title: {type: String, required: true, trim: true, minlength: 3, maxlength: 100},
    amount: {type: Number, required: true, min: 1, set:toDBAmount, get:fromDBAmount},
    splitBetween: {
        type: [
            {
                userId: {type: mongoose.Types.ObjectId, ref: "User", required: true},
                amount: {type: Number, required: true, min: 1, set:toDBAmount, get:fromDBAmount}
            }
        ]
    },
    paidBy: {type: mongoose.Types.ObjectId, ref: "User", required: true},
    paymentType: {type: String, enum: PAYMENT_TYPES, required: true},
    date: {type: Date, required: true, default: Date.now},
    isDeleted: {type: Boolean, default: false}
}, {timestamps: true, toJSON: { getters: true }, toObject: { getters: true }});

expenseSchema.path("splitBetween").validate(function (value: any[]) {
    if (!value || value.length === 0) return true;

    const totalSplit = value.reduce(
        (sum, split) => sum + split.amount,
        0
    );

    const userIds = value.map(v => v.userId?.toString());
    if (userIds.includes(undefined)) return false;

    const uniqueUserIds = new Set(userIds);

    return (
        Math.abs(totalSplit - this.amount) === 0 &&
        userIds.length === uniqueUserIds.size
    );
}, "Enter valid split amounts");

export default mongoose.model<IExpense>("Expense", expenseSchema);