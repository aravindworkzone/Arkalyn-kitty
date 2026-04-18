import { createExpenseService } from "../Service/expense.service";
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

// exports.deleteExpense = async (req, res) => {
//     const expenseId = req.params.id;

//     if (!mongoose.Types.ObjectId.isValid(expenseId)) {
//         return res.status(400).json({ message: "Invalid expense ID format" });
//     }

//     const session = await mongoose.startSession();
//     try {
//         session.startTransaction();
//         const expense = await Expense.findByIdAndDelete(expenseId, { session });

//         if (!expense) {
//             throw Object.assign(new Error('Expense not found'), { status: 404 });
//         }

//         const payBy = await User.findById(expense.paidBy);

//         if(!payBy) { 
//             throw Object.assign(new Error('User not found'), { status: 404 });
//         }

//         await GroupEvent.create([{
//             groupId: req.group._id,
//             performedBy: req.user._id,
//             eventType: "REFUND",
//             metadata: { userId: req.user._id, note: `Deleted expense: ${expense.title} by ${payBy.name} for ${expense.amount}` },
//             referenceId: expense._id,
//             referenceModel: "expense"
//         }], { session });

//         await session.commitTransaction();

//         return res.status(200).json({ message: "Expense deleted", expense });
//     } catch (error) {
//         await session.abortTransaction();
//         const statusCode = error.status || 500;
//         return res.status(statusCode).json({ message: 'Error deleting expense', error: error.message });
//     } finally {
//         session.endSession();
//     }
// }