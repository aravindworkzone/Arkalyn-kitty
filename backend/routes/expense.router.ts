import express from 'express';
import {
    createExpense,
    deleteExpense,
    getExpenseAddDetails,
    paymentMethods,
    expenseReport,
    getAllExpenses,
} from '../controllers/expense.controller';
import { verifyToken, authorizeRole, loadGroup } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createExpenseBodySchema,
    deleteExpenseParamsSchema,
    deleteExpenseBodySchema,
    groupIdOnlyParamsSchema,
} from '../validators/expense.validator';

const router = express.Router();

router.post(
    '/create',
    validate({ body: createExpenseBodySchema }),
    verifyToken,
    loadGroup,
    createExpense
);

router.delete(
    '/delete/:id',
    validate({ params: deleteExpenseParamsSchema, body: deleteExpenseBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    deleteExpense
);

router.get(
    '/getExpenseAddDetails/:groupId',
    validate({ params: groupIdOnlyParamsSchema }),
    verifyToken,
    loadGroup,
    getExpenseAddDetails
);

router.get('/paymentMethods', verifyToken, paymentMethods);

router.get(
    '/expensereport/:groupId',
    validate({ params: groupIdOnlyParamsSchema }),
    verifyToken,
    loadGroup,
    expenseReport
);

router.get(
    '/allexpenses/:groupId',
    validate({ params: groupIdOnlyParamsSchema }),
    verifyToken,
    loadGroup,
    getAllExpenses
);

export default router;
