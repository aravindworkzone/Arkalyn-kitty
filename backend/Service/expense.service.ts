import mongoose from "mongoose";
import Expense from "../Model/expense.model";
import Group from "../Model/group.model";
import GroupTransaction from "../Model/group_transaction.model";
import { AppError } from "../Helper/AppError";
import User from "../Model/user.model";
import Category from "../Model/category.model";
import GroupMembers from "../Model/group_member.model";
import { PAYMENT_TYPES, PaymentType } from "../Model/expense.model";

interface ExpenseData {
    user: string;
    group: {
        _id: string;
        balance: number;
    };
    category: string;
    title: string;
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
        throw AppError("All fields are required", 400);
    }

    if( groupData.balance < amount) {
        throw AppError("Amount cannot be greater than group balance", 400);
    }

    const ids = [
        groupData._id,
        category,
        paidBy,
        ...splitBetween.map(s => s.userId)
    ];

    const validObjectIds = ids.every(id => mongoose.Types.ObjectId.isValid(id));
    if (!validObjectIds) {
        throw AppError("Invalid ID format", 400);
    }

    if(title.length < 3 || title.length > 100) {
        throw AppError("Title must be between 3 and 100 characters", 400);
    }

    if (amount <= 0) {
        throw AppError("Valid amount required", 400);
    }

    if (!PAYMENT_TYPES.includes(paymentType)) {
        throw AppError("Invalid payment type", 400);
    }

    const expenseDate = new Date(date);
    if (isNaN(expenseDate.getTime())) {
        throw AppError("Invalid date format", 400);
    }

    const paidByUser = await User.findById(paidBy);
    if (!paidByUser) {
        throw AppError("Paid by user not found", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const expense = {
            groupId: groupData._id,
            category,
            title,
            amount,
            paidBy,
            paymentType,
            date,
            splitBetween: [] as { userId: string; amount: number }[]
        }

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

        if (!updated) throw AppError("Insufficient group balance", 400);

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

    } catch (error : any) {
        await session.abortTransaction();
        if (error.name === "ValidationError") throw AppError(error.message, 400);
        throw AppError(error.data.message || "Internal server error", error.statusCode || 500);
    } finally {
        session.endSession();
    }
};

export const deleteExpenseService = async (data: { expenseId: string, groupId: string, userId: string, reason?: string }) => {
    if (!mongoose.Types.ObjectId.isValid(data.expenseId)) {
        throw AppError("Invalid expense ID format", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const expense = await Expense.findByIdAndUpdate(data.expenseId, { isDeleted: true }, { session });
        if (!expense) throw AppError('Expense not found', 404);

        const payBy = await User.findById(expense.paidBy).session(session);
        if (!payBy) throw AppError('User not found', 404);

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
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        session.endSession();
    }
};

export const getExpenseAddDetailsService = async (groupId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) => {
    try {
        const category = await Category.find({ groupId, isDeleted: false });
        const payMethods = await Expense.distinct("paymentType");
        const members = await GroupMembers.find({ groupId });
        console.log(category, payMethods, members);
    } catch (error : any) {
        if (error.name === "ValidationError") throw AppError(error.message, 400);
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    }
}

export const paymentMethodService = async () => {
    try {
        return PAYMENT_TYPES;
    } catch (error : any) {
        if (error.name === "ValidationError") throw AppError(error.message, 400);
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    }
};


export const expenseReportService = async (groupId: mongoose.Types.ObjectId) => {
    const start = new Date().setHours(0, 0, 0, 0);
    const end = new Date().setHours(23, 59, 59, 999);
    if(!groupId) throw AppError("Group ID is required", 400);
    try {
        const expenses = await Expense.find({ groupId, isDeleted: false, date: { $gte: start, $lte: end } })
            .populate("paidBy")
            .populate("category")
            .populate("splitBetween.userId", "name email");
        return expenses;
    } catch (error : any) {
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    }
}

export const getAllExpensesService = async (groupId: mongoose.Types.ObjectId) => {
    if(!groupId) throw AppError("Group ID is required", 400);
    try {
        const expenses = await Expense.find({ groupId, isDeleted: false })
            .populate("paidBy")
            .populate("category")
            .populate("splitBetween.userId", "name email")
            .sort({ date: -1 });
        return expenses;
    } catch (error : any) {
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    }
}