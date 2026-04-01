const Expense = require("../models/expense.model");
exports.createExpense = async (req, res) => {
    try {
        const groupId = req.body.groupId.trim() || null;
        const category = req.body.category.trim() || null;
        const title = req.body.title.trim() || null;
        const amount = req.body.amount || null;
        const splitBetween = req.body.splitBetween || [];
        const paidBy = req.body.paidBy.trim() || null;
        const paymentType = req.body.paymentType.trim() || null;
        const date = req.body.date || null;

        if (!groupId || !category || !title || !amount || !paidBy || !paymentType || !date) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const ids = [groupId, category, paidBy, ...splitBetween.map(s => s.userId)];
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