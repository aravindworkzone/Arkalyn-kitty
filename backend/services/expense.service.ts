import mongoose from "mongoose";
import Expense, { IExpense } from "../models/expense.model";
import Group from "../models/group.model";
import GroupTransaction from "../models/group_transaction.model";
import GroupEvent from "../models/group_event.model";
import { AppError } from "../helpers/AppError";
import User from "../models/user.model";
import Category from "../models/category.model";
import GroupMembers from "../models/group_member.model";
import { PAYMENT_TYPES, PaymentType } from "../models/expense.model";
import { debitGroupBalance, refundGroupBalance } from "../helpers/balanceOps";

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

        const updated = await debitGroupBalance(groupData._id, amount, { session });

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

        // expense.amount getter returns rupees.
        const balanceUpdate = expense.amount;

        await refundGroupBalance(data.groupId, balanceUpdate, { session });

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

interface ExpenseSnapshot {
    title: string;
    description: string;
    amount: number;
    paymentType: string;
    date: Date;
    category: string;
    paidBy: string;
    splitBetween: { userId: string; amount: number }[];
}

// Build a human-readable, field-level diff of only the fields that actually
// changed. Resolves category/user ids to names so the edit log reads naturally.
const buildExpenseDiff = async (
    oldV: ExpenseSnapshot,
    newV: ExpenseSnapshot,
    session: mongoose.ClientSession,
) => {
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (oldV.title !== newV.title) changes.title = { from: oldV.title, to: newV.title };
    if (oldV.description !== newV.description)
        changes.description = { from: oldV.description || "—", to: newV.description || "—" };
    if (oldV.amount !== newV.amount) changes.amount = { from: oldV.amount, to: newV.amount };
    if (oldV.paymentType !== newV.paymentType)
        changes.paymentType = { from: oldV.paymentType, to: newV.paymentType };

    const oldDate = new Date(oldV.date).toISOString().slice(0, 10);
    const newDate = new Date(newV.date).toISOString().slice(0, 10);
    if (oldDate !== newDate) changes.date = { from: oldDate, to: newDate };

    if (oldV.category !== newV.category) {
        const [oldCat, newCat] = await Promise.all([
            Category.findById(oldV.category).session(session),
            Category.findById(newV.category).session(session),
        ]);
        changes.category = { from: oldCat?.name ?? oldV.category, to: newCat?.name ?? newV.category };
    }

    const idSet = new Set<string>();
    if (oldV.paidBy !== newV.paidBy) { idSet.add(oldV.paidBy); idSet.add(newV.paidBy); }
    const splitKey = (arr: { userId: string; amount: number }[]) =>
        JSON.stringify(arr.map((s) => [s.userId, s.amount]).sort());
    const splitsChanged = splitKey(oldV.splitBetween) !== splitKey(newV.splitBetween);
    if (splitsChanged) [...oldV.splitBetween, ...newV.splitBetween].forEach((s) => idSet.add(s.userId));

    let nameMap: Record<string, string> = {};
    if (idSet.size > 0) {
        const users = await User.find({ _id: { $in: [...idSet] } }, "name").session(session);
        nameMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
    }
    if (oldV.paidBy !== newV.paidBy)
        changes.paidBy = { from: nameMap[oldV.paidBy] ?? oldV.paidBy, to: nameMap[newV.paidBy] ?? newV.paidBy };
    if (splitsChanged) {
        const fmt = (arr: { userId: string; amount: number }[]) =>
            arr.length === 0 ? "No split" : arr.map((s) => `${nameMap[s.userId] ?? "?"}: ₹${s.amount}`).join(", ");
        changes.splitBetween = { from: fmt(oldV.splitBetween), to: fmt(newV.splitBetween) };
    }

    return changes;
};

export const updateExpenseService = async (data: ExpenseData & { expenseId: string }) => {
    const groupData = data.group;
    const groupId = groupData._id;
    const category = data.category.trim();
    const title = data.title.trim();
    const amount = data.amount;
    const splitBetween = Array.isArray(data.splitBetween) ? data.splitBetween : [];
    const paidBy = data.paidBy.trim();
    const paymentType = data.paymentType;
    const date = data.date ?? null;
    const userId = data.user;
    const expenseId = data.expenseId;

    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
        throw new AppError("Invalid expense ID format", 400);
    }

    if (!groupId || !category || !title || !amount || !paidBy || !paymentType || !date) {
        throw new AppError("All fields are required", 400);
    }

    const ids = [groupId, category, paidBy, ...splitBetween.map((s) => s.userId)];
    if (!ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
        throw new AppError("Invalid ID format", 400);
    }

    if (title.length < 3 || title.length > 100) {
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

        const expense = await Expense.findOne({ _id: expenseId, groupId, isDeleted: false }).session(session);
        if (!expense) throw new AppError("Expense not found", 404);

        // Authorize: admins (ADMIN/SUPER_ADMIN) or the expense's own payer.
        const member = await GroupMembers.findOne({ groupId, userId, isDeleted: false }).session(session);
        const isAdmin = member?.role === "ADMIN" || member?.role === "SUPER_ADMIN";
        const isPayer = expense.paidBy.equals(userId);
        if (!isAdmin && !isPayer) {
            throw new AppError("You are not allowed to edit this expense", 403);
        }

        // Snapshot the old values (amount getter returns rupees) before mutating.
        const oldAmount = expense.amount;
        const oldValues: ExpenseSnapshot = {
            title: expense.title,
            description: expense.description ?? "",
            amount: oldAmount,
            paymentType: expense.paymentType,
            date: expense.date,
            category: expense.category.toString(),
            paidBy: expense.paidBy.toString(),
            splitBetween: expense.splitBetween.map((s) => ({ userId: s.userId.toString(), amount: s.amount })),
        };

        // Adjust the pool balance by the amount delta only.
        const delta = parseFloat((amount - oldAmount).toFixed(2));
        if (delta > 0) {
            const updated = await debitGroupBalance(groupId, delta, { session });
            if (!updated) throw new AppError("Amount cannot be greater than group balance", 400);
        } else if (delta < 0) {
            await refundGroupBalance(groupId, -delta, { session });
        }

        // Mutate + save the document so the model's split-sum/unique validator runs.
        expense.title = title;
        expense.description = data.description?.trim() || undefined;
        expense.amount = amount;
        expense.paidBy = new mongoose.Types.ObjectId(paidBy);
        expense.category = new mongoose.Types.ObjectId(category);
        expense.paymentType = paymentType;
        expense.date = expenseDate;
        expense.splitBetween =
            splitBetween.length > 0
                ? splitBetween.map((s) => ({ userId: new mongoose.Types.ObjectId(s.userId), amount: s.amount })) as typeof expense.splitBetween
                : ([] as unknown as typeof expense.splitBetween);
        await expense.save({ session });

        // Audit the balance movement (only when the amount changed).
        if (delta !== 0) {
            await GroupTransaction.create([{
                groupId,
                amount: Math.abs(delta),
                action: delta > 0 ? "DEBIT" : "REFUND",
                description: `Edit: "${title}" amount ${delta > 0 ? "increased" : "decreased"} by ${Math.abs(delta)} by ${paidByUser.name}`,
                referenceId: expense._id,
                referenceModel: "Expense",
                performedBy: userId,
            }], { session });
        }

        // Edit log: an EXPENSE_EDITED event with a before→after diff.
        const changes = await buildExpenseDiff(
            oldValues,
            {
                title,
                description: data.description?.trim() || "",
                amount,
                paymentType,
                date: expenseDate,
                category,
                paidBy,
                splitBetween: splitBetween.map((s) => ({ userId: s.userId, amount: s.amount })),
            },
            session,
        );
        const changedFields = Object.keys(changes);
        const note =
            changedFields.length > 0
                ? `Edited "${title}" — changed ${changedFields.join(", ")}`
                : `Edited "${title}"`;

        await GroupEvent.create([{
            groupId,
            performedBy: userId,
            eventType: "EXPENSE_EDITED",
            referenceId: expense._id,
            referenceModel: "Expense",
            metadata: { note, changes },
        }], { session });

        await session.commitTransaction();
        return expense;
    } catch (error: any) {
        await session.abortTransaction();
        throw error instanceof AppError
            ? error
            : new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        session.endSession();
    }
};

export const getExpenseByIdService = async (groupId: mongoose.Types.ObjectId, expenseId: string) => {
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
        throw new AppError("Invalid expense ID format", 400);
    }
    const expense = await Expense.findOne({ _id: expenseId, groupId, isDeleted: false })
        .populate("paidBy")
        .populate("category")
        .populate("splitBetween.userId", "name email");
    if (!expense) throw new AppError("Expense not found", 404);
    return expense;
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

interface ExpenseListFilters {
    categoryId?: string;
    paidBy?: string;
    spender?: string;
    startDate?: Date;
    endDate?: Date;
}

export const getAllExpensesService = async (
    groupId: mongoose.Types.ObjectId,
    page: number,
    limit: number,
    filters: ExpenseListFilters = {}
) => {
    if(!groupId) throw new AppError("Group ID is required", 400);
    try {
        // Optional filters let the report page deep-link into a pre-filtered view.
        const query: Record<string, unknown> = { groupId, isDeleted: false };
        if (filters.categoryId) query.category = filters.categoryId;
        if (filters.paidBy) query.paidBy = filters.paidBy;
        // "Spent by" — expenses the member shared in, plus unsplit expenses they
        // paid for. Mirrors the member report's attribution so the drill-through
        // matches the chart.
        if (filters.spender) {
            query.$or = [
                { 'splitBetween.userId': filters.spender },
                { paidBy: filters.spender, 'splitBetween.0': { $exists: false } },
            ];
        }
        // Member drill-downs (by spender/payer) must reconcile with the member
        // breakdown, which excludes special "collective" categories. When no
        // explicit category is requested, drop special categories too.
        if (!filters.categoryId && (filters.spender || filters.paidBy)) {
            const specialIds = await Category
                .find({ groupId, isSpecial: true, isDeleted: false })
                .select('_id')
                .lean();
            if (specialIds.length) query.category = { $nin: specialIds.map((c) => c._id) };
        }
        if (filters.startDate || filters.endDate) {
            const dateRange: Record<string, Date> = {};
            if (filters.startDate) dateRange.$gte = filters.startDate;
            if (filters.endDate) dateRange.$lte = filters.endDate;
            query.date = dateRange;
        }

        const [items, total] = await Promise.all([
            Expense.find(query)
                .populate("paidBy")
                .populate("category")
                .populate("splitBetween.userId", "name email")
                .sort({ date: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Expense.countDocuments(query),
        ]);
        return { items, total };
    } catch (error : any) {
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
}

export interface DuplicateCheckResult {
    tier: 1 | 2 | null;
    match: {
        _id: string;
        title: string;
        amount: number;
        date: Date;
        category: { name: string };
        createdBy: { name: string };
    } | null;
}

export const checkDuplicateExpenseService = async (
    groupId: mongoose.Types.ObjectId,
    amount: number,
    date: Date,
    categoryId?: string,
    excludeExpenseId?: string
): Promise<DuplicateCheckResult> => {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new AppError("Invalid group ID format", 400);
    }

    const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const endOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

    const baseQuery: Record<string, unknown> = {
        groupId,
        isDeleted: false,
        amount,
        date: { $gte: startOfDay, $lt: endOfDay },
    };
    if (excludeExpenseId && mongoose.Types.ObjectId.isValid(excludeExpenseId)) {
        baseQuery._id = { $ne: excludeExpenseId };
    }

    const runQuery = async (query: Record<string, unknown>) => {
        type PopulatedExpense = Omit<IExpense, "category" | "paidBy"> & {
            category: {
                name: string;
            };
            paidBy: {
                name: string;
            };
        };
        const expense = await Expense.findOne(query)
            .populate("category", "name")
            .populate("paidBy", "name")
            .lean<PopulatedExpense>();
        if (!expense) return null;
        return {
            _id: expense._id.toString(),
            title: expense.title,
            amount: expense.amount,
            date: expense.date,
            category: { name: (expense.category as { name: string }).name },
            createdBy: { name: (expense.paidBy as { name: string }).name },
        };
    };

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
        const tier2Match = await runQuery({ ...baseQuery, category: categoryId });
        if (tier2Match) return { tier: 2, match: tier2Match };
    }

    const tier1Match = await runQuery(baseQuery);
    if (tier1Match) return { tier: 1, match: tier1Match };

    return { tier: null, match: null };
};