const Expense = require("../model/expense.model");
const mongoose = require("mongoose");
exports.createExpense = async (req, res) => {
    try {
        const groupId = typeof req.body.groupId === "string" ? req.body.groupId.trim() : null;
        const category = typeof req.body.category === "string" ? req.body.category.trim() : null;
        const title = typeof req.body.title === "string" ? req.body.title.trim() : null;
        const amount = req.body.amount ?? null;
        const splitBetween = Array.isArray(req.body.splitBetween) ? req.body.splitBetween : [];
        const paidBy = typeof req.body.paidBy === "string" ? req.body.paidBy.trim() : null;
        const paymentType = typeof req.body.paymentType === "string" ? req.body.paymentType.trim() : null;
        const date = req.body.date ?? null;

        if (!groupId || !category || !title || !amount || !paidBy || !paymentType || !date) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const ids = [
            groupId,
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

        const expense = {
            groupId,
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

        await expenseSave.save();

        res.status(201).json({ message: "Expense created", expense });

    } catch (error) {
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const expenseId = req.body.id;

        if (!mongoose.Types.ObjectId.isValid(expenseId)) {
            return res.status(400).json({ message: "Invalid expense ID format" });
        }

        const expense = await Expense.findByIdAndDelete(expenseId);

        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        res.status(200).json({ message: "Expense deleted", expense });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting expense', error });
        console.error('Error deleting expense:', error);
    }
}