const Expense = require('../model/expense.model');
const mongoose = require("mongoose");

exports.getReport = async (req, res) => {
    try {
        const groupId = typeof req.params.groupId === "string" ? req.params.groupId.trim() : null;
        const startDate = req.params.startDate ? new Date(req.params.startDate) : null;
        const endDate = req.params.endDate ? new Date(req.params.endDate) : null;

        if (!groupId) {
            return res.status(400).json({ message: "Group ID is required" });
        }
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }
        const expenses = await Expense.find({ groupId, date: { $gte: startDate, $lte: endDate } });

        if (!expenses || expenses.length === 0) {
            return res.status(404).json({ message: "Expenses not found" });
        }

        res.status(200).json({ message: "Fetched report", expenses });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching report', error: error.message });
    }
}