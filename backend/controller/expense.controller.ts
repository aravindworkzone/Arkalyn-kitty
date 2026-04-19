import { createExpenseService, deleteExpenseService } from "../Service/expense.service";
import { Request, Response } from "express";

export const createExpense = async (req: Request, res: Response) => {
    try {
        const expenseSave = await createExpenseService(req.body);
        return res.status(201).json({ message: "Expense created", expenseSave });

    } catch (error: any) {
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: "Internal server error", error: error.message });
    }
};

export const deleteExpense = async (req: Request, res: Response) => {
    if (!req.group?._id) {
        return res.status(400).json({ message: "Group not found" });
    }

    if (!req.user?._id) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    const groupId = req.group._id.toString();
    const userId = req.user._id.toString();

    const expenseId = req.params.id;

    if (!expenseId) {
        return res.status(400).json({ message: "Expense ID required" });
    }
    try {
        const expense = await deleteExpenseService({ expenseId: req.params.id as string, groupId, userId });
        return res.status(200).json({ message: "Expense deleted", expense });
    } catch (error: any) {
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: "Internal server error", error: error.message });
    }
}