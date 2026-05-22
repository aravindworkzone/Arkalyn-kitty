import {
    createExpenseService,
    deleteExpenseService,
    getExpenseAddDetailsService,
    paymentMethodService,
    expenseReportService,
    getAllExpensesService,
} from '../services/expense.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { AppError } from '../helpers/AppError';
import { paginationQuerySchema } from '../validators/common';
import { emitToGroup, SOCKET_EVENTS } from "../sockets/index";

export const createExpense = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (!req.user?._id) throw new AppError('User not authenticated', 401);

    const expense = await createExpenseService({
        ...req.body,
        group: req.group,
        user: req.user._id,
    });

    emitToGroup(req.group.displayId.toString(), SOCKET_EVENTS.EXPENSE_CREATED);

    sendCreated(res, { expense }, 'Expense created');
});

export const deleteExpense = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (!req.user?._id) throw new AppError('User not authenticated', 401);
    const expenseId = typeof req.params.id === 'string' ? req.params.id : '';
    if (!expenseId) throw new AppError('Expense ID required', 400);

    const expense = await deleteExpenseService({
        expenseId,
        groupId: req.group._id.toString(),
        userId: req.user._id.toString(),
        reason: typeof req.body.reason === 'string' ? req.body.reason : undefined,
    });

    emitToGroup(req.group.displayId.toString(), SOCKET_EVENTS.EXPENSE_DELETED);

    sendSuccess(res, { expense }, 'Expense deleted');
});

export const getExpenseAddDetails = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (!req.user?._id) throw new AppError('User not authenticated', 401);

    const details = await getExpenseAddDetailsService(req.group._id, req.user._id);
    sendSuccess(res, details, 'Expense form details');
});

export const paymentMethods = asyncHandler(async (_req, res) => {
    const paymentMethods = await paymentMethodService();
    sendSuccess(res, { paymentMethods }, 'Payment methods');
});

export const expenseReport = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const report = await expenseReportService(req.group._id);
    sendSuccess(res, { report }, 'Expense report');
});

export const getAllExpenses = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const { page = 1, limit = 20 } = paginationQuerySchema.parse(req.query);
    const { items, total } = await getAllExpensesService(req.group._id, page, limit);
    sendPaginated(res, items, total, page, limit, 'Expenses fetched');
});
