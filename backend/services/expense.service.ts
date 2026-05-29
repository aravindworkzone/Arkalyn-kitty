import mongoose from "mongoose";
import Expense from "../models/expense.model";
import Group from "../models/group.model";
import GroupTransaction from "../models/group_transaction.model";
import { AppError } from "../helpers/AppError";
import User from "../models/user.model";
import Category from "../models/category.model";
import GroupMembers from "../models/group_member.model";
import { PAYMENT_TYPES, PaymentType } from "../models/expense.model";

interface ExpenseData {
    user: string;
    group: {
        _id: string;
        balance: number;
    };
    category: string;
    title: string;
    description?: string;
    amount: number;
    paymentType: PaymentType;
    paidBy: string;
    date: Date;
    splitBetween?: {
        userId: string;
        amount: number;
    }[];
}

export const createExpenseService = async (data: ExpenseData) => {
    const groupData = data.group;
    const category = data.category.trim();
    const title = data.title.trim();
    const amount = data.amount;
    const splitBetween = Array.isArray(data.splitBetween) ? data.splitBetween : [];
    const paidBy = data.paidBy.trim();
    const paymentType = data.paymentType;
    const date = data.date ?? null;
    const userId = data.user;

    if (!groupData._id || !category || !title || !amount || !paidBy || !paymentType || !date) {
        throw new AppError("All fields are required", 400);
    }

    if( groupData.balance < amount) {
        throw new AppError("Amount cannot be greater than group balance", 400);
    }

    const ids = [
        groupData._id,
        category,
        paidBy,
        ...splitBetween.map(s => s.userId)
    ];

    const validObjectIds = ids.every(id => mongoose.Types.ObjectId.isValid(id));
    if (!validObjectIds) {
        throw new AppError("Invalid ID format", 400);
    }

    if(title.length < 3 || title.length > 100) {
        throw new AppError("Title must be between 3 and 100 characters", 400);
    }

    if (amount <= 0) {
        throw new AppError("Valid amount required", 400);
    }

    if (!PAYMENT_TYPES.includes(paymentType)) {
        throw new AppError("Invalid payment type", 400);
    }

    const expenseDate = new Date(date);
    if (isNaN(expenseDate.getTime())) {
        throw new AppError("Invalid date format", 400);
    }

    const paidByUser = await User.findById(paidBy);
    if (!paidByUser) {
        throw new AppError("Paid by user not found", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const expense: {
            groupId: string;
            category: string;
            title: string;
            description?: string;
            amount: number;
            paidBy: string;
            paymentType: PaymentType;
            date: Date;
            splitBetween: { userId: string; amount: number }[];
        } = {
            groupId: groupData._id,
            category,
            title,
            amount,
            paidBy,
            paymentType,
            date,
            splitBetween: [],
        };
        if (data.description?.trim()) expense.description = data.description.trim();

        if (splitBetween.length > 0) {
            expense.splitBetween = splitBetween;
        }

        const expenseSave = new Expense(expense);

        await expenseSave.save({ session });

        const updated = await Group.findOneAndUpdate(
            {
                _id: groupData._id,
                balance: { $gte: amount }
            },
            {
                $inc: { balance: -amount }
            },
            { returnDocument: "after", session }
        );

        if (!updated) throw new AppError("Insufficient group balance", 400);

        await GroupTransaction.create([{
            groupId: groupData._id,
            amount: amount,
            action: "DEBIT",
            description: `Expense: ${expense.title} by ${paidByUser.name} for ${amount}`,
            referenceId: expenseSave._id,
            referenceModel: "Expense",
            performedBy: userId
        }], { session });

        await session.commitTransaction();

        return expenseSave;

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const deleteExpenseService = async (data: { expenseId: string, groupId: string, userId: string, reason?: string }) => {
    if (!mongoose.Types.ObjectId.isValid(data.expenseId)) {
        throw new AppError("Invalid expense ID format", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const expense = await Expense.findByIdAndUpdate(data.expenseId, { isDeleted: true }, { session });
        if (!expense) throw new AppError('Expense not found', 404);

        const payBy = await User.findById(expense.paidBy).session(session);
        if (!payBy) throw new AppError('User not found', 404);

        const balanceUpdate = expense.amount;

        await Group.findByIdAndUpdate(
            data.groupId, 
            { $inc: { balance: balanceUpdate } },
            { session }
        );

        await GroupTransaction.create([{
            groupId: data.groupId,
            amount: balanceUpdate,
            action: "REFUND",
            description: `Refund: "${expense.title}" paid by ${payBy.name}${data.reason ? `. Reason: ${data.reason}` : ""}`,
            referenceId: expense._id,
            referenceModel: "Expense",
            performedBy: data.userId,
        }], { session });

        await session.commitTransaction();
        return expense;
    } catch (error: any) {
        await session.abortTransaction();
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        session.endSession();
    }
};

export const getExpenseAddDetailsService = async (groupId: mongoose.Types.ObjectId, _userId: mongoose.Types.ObjectId) => {
    const [categories, payMethods, members] = await Promise.all([
        Category.find({ groupId, isDeleted: false }),
        Expense.distinct("paymentType"),
        GroupMembers.find({ groupId, isDeleted: false }),
    ]);
    return { categories, payMethods, members };
}

export const paymentMethodService = async () => {
    try {
        return PAYMENT_TYPES;
    } catch (error : any) {
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
};


export const expenseReportService = async (groupId: mongoose.Types.ObjectId) => {
    const start = new Date().setHours(0, 0, 0, 0);
    const end = new Date().setHours(23, 59, 59, 999);
    if(!groupId) throw new AppError("Group ID is required", 400);
    try {
        const expenses = await Expense.find({ groupId, isDeleted: false, date: { $gte: start, $lte: end } })
            .populate("paidBy")
            .populate("category")
            .populate("splitBetween.userId", "name email");
        return expenses;
    } catch (error : any) {
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
}

export const getAllExpensesService = async (
    groupId: mongoose.Types.ObjectId,
    page: number,
    limit: number
) => {
    if(!groupId) throw new AppError("Group ID is required", 400);
    try {
        const [items, total] = await Promise.all([
            Expense.find({ groupId, isDeleted: false })
                .populate("paidBy")
                .populate("category")
                .populate("splitBetween.userId", "name email")
                .sort({ date: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Expense.countDocuments({ groupId, isDeleted: false }),
        ]);
        return { items, total };
    } catch (error : any) {
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
}