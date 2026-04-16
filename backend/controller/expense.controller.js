const Expense = require("../Model/expense.model");
const Group = require("../Model/group.model");
const GroupEvent = require("../Model/group_event.model");
const mongoose = require("mongoose");
exports.createExpense = async (req, res) => {
    const groupData = req.group;
    const category = typeof req.body.category === "string" ? req.body.category.trim() : null;
    const title = typeof req.body.title === "string" ? req.body.title.trim() : null;
    const amount = req.body.amount ?? null;
    const splitBetween = Array.isArray(req.body.splitBetween) ? req.body.splitBetween : [];
    const paidBy = typeof req.body.paidBy === "string" ? req.body.paidBy.trim() : null;
    const paymentType = typeof req.body.paymentType === "string" ? req.body.paymentType.trim() : null;
    const date = req.body.date ?? null;

    if (!groupData._id || !category || !title || !amount || !paidBy || !paymentType || !date) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if( groupData.balance < amount) {
        return res.status(400).json({ message: "Amount cannot be greater than group balance" });
    }

    const ids = [
        groupData._id,
        category,
        paidBy,
        ...splitBetween.map(s => s.userId)
    ];

    const validObjectIds = ids.every(id => mongoose.Types.ObjectId.isValid(id));
    if (!validObjectIds) {
        return res.status(400).json({ message: "Invalid ID format" });
    }

    if(title.length < 3 || title.length > 100) {
        return res.status(400).json({ message: "Title must be between 3 and 100 characters" });
    }

    if (amount <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
    }

    const validPaymentTypes = ["cash", "card", "online"];
    if (!validPaymentTypes.includes(paymentType)) {
        return res.status(400).json({ message: "Invalid payment type" });
    }

    const expenseDate = new Date(date);
    if (isNaN(expenseDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
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
            date
        }

        if (splitBetween.length > 0) {
            expense.splitBetween = splitBetween;
        }

        const expenseSave = new Expense(expense);

        await expenseSave.save({ session });

        await Group.findOneAndUpdate(
            {
                _id: groupData._id,
                balance: { $gte: amount }
            },
            {
                $inc: { balance: -amount }
            },
            { returnDocument: "after", session }
        );

        await GroupEvent.create([{
            groupId: groupData._id,
            performedBy: req.user._id,
            eventType: "DEBIT",
            metadata: { userId: req.user._id, note: `Expense: ${expense.title} by ${paidBy} for ${amount}` },
            referenceModel: "expense",
            referenceId: expenseSave._id,
            amount: amount
        }], { session });

        await session.commitTransaction();

        return res.status(201).json({ message: "Expense created", expenseSave });

    } catch (error) {
        await session.abortTransaction();
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        session.endSession();
    }
};

exports.deleteExpense = async (req, res) => {
    const expenseId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
        return res.status(400).json({ message: "Invalid expense ID format" });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const expense = await Expense.findByIdAndDelete(expenseId, { session });

        if (!expense) {
            throw Object.assign(new Error('Expense not found'), { status: 404 });
        }

        const payBy = await User.findById(expense.paidBy);

        if(!payBy) { 
            throw Object.assign(new Error('User not found'), { status: 404 });
        }

        await GroupEvent.create([{
            groupId: req.group._id,
            performedBy: req.user._id,
            eventType: "REFUND",
            metadata: { userId: req.user._id, note: `Deleted expense: ${expense.title} by ${payBy.name} for ${expense.amount}` },
            referenceId: expense._id,
            referenceModel: "expense"
        }], { session });

        await session.commitTransaction();

        return res.status(200).json({ message: "Expense deleted", expense });
    } catch (error) {
        await session.abortTransaction();
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: 'Error deleting expense', error: error.message });
    } finally {
        session.endSession();
    }
}