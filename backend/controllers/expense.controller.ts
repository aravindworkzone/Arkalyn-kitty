import { createExpenseService, deleteExpenseService, getExpenseAddDetailsService, paymentMethodService, expenseReportService, getAllExpensesService } from "../services/expense.service";
import { Request, Response } from "express";

export const createExpense = async (req: Request, res: Response) => {
    if (!req.group?._id) {
        return res.status(400).json({ message: "Group not found" });
    }

    if (!req.user?._id) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    const expenseAdd = { ...req.body, group: req.group._id, user: req.user._id };
    try {
        const expenseSave = await createExpenseService(expenseAdd);
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
        const expense = await deleteExpenseService({ expenseId: req.params.id as string, groupId, userId, reason: req.body.reason as string | undefined });
        return res.status(200).json({ message: "Expense deleted", expense });
    } catch (error: any) {
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: "Internal server error", error: error.message });
    }
}

export const getExpenseAddDetails = async (req: Request, res: Response) => {
    if (!req.group?._id) {
        return res.status(400).json({ message: "Group not found" });
    }

    if (!req.user?._id) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    try {
        const expenseSave = await getExpenseAddDetailsService(req.group._id, req.user._id);
        return res.status(201).json({ message: "Expense created" });
    } catch (error: any) {
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: "Internal server error", error: error.message });
    }
};

export const paymentMethods = async (req: Request, res: Response) => {
    try {
        const paymentMethods = await paymentMethodService();
        return res.status(200).json({ message: "Payment methods", paymentMethods });
    } catch (error: any) {
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: "Internal server error", error: error.message });    
    }
};

export const expenseReport = async (req: Request, res: Response) => {
    if(!req.group?._id) return res.status(400).json({ message: "Group not found" });
    try {
        const report = await expenseReportService(req.group._id);
        return res.status(200).json({ message: "Expense report", report });
    } catch (error: any) {
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: "Internal server error", error: error.message });
    }
};

export const getAllExpenses = async (req: Request, res: Response) => {
    if(!req.group?._id) return res.status(400).json({ message: "Group not found" });
    try {
        const expenses = await getAllExpensesService(req.group._id);
        return res.status(200).json({ message: "Expenses fetched", expenses });
    } catch (error: any) {
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: "Internal server error", error: error.message });
    }
};

