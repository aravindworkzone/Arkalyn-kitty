import express from 'express';
import {
    createExpense,
    updateExpense,
    getExpenseById,
    deleteExpense,
    getExpenseAddDetails,
    paymentMethods,
    expenseReport,
    getAllExpenses,
    checkDuplicateExpense,
} from '../controllers/expense.controller';
import { verifyToken, authorizeRole, loadGroup, ensureGroupActive } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createExpenseBodySchema,
    updateExpenseParamsSchema,
    updateExpenseBodySchema,
    getOneExpenseParamsSchema,
    deleteExpenseParamsSchema,
    deleteExpenseBodySchema,
    groupIdOnlyParamsSchema,
    allExpensesQuerySchema,
    duplicateCheckQuerySchema,
} from '../validators/expense.validator';

const router = express.Router();

router.post(
    '/create',
    validate({ body: createExpenseBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    createExpense
);

// Edit is gated inside the service (admins OR the expense's payer) — not via
// authorizeRole, which can't see who paid. Hence no role middleware here.
router.patch(
    '/update/:id',
    validate({ params: updateExpenseParamsSchema, body: updateExpenseBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    updateExpense
);

router.get(
    '/one/:groupId/:id',
    validate({ params: getOneExpenseParamsSchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    getExpenseById
);

router.delete(
    '/delete/:id',
    validate({ params: deleteExpenseParamsSchema, body: deleteExpenseBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    deleteExpense
);

router.get(
    '/getExpenseAddDetails/:groupId',
    validate({ params: groupIdOnlyParamsSchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    getExpenseAddDetails
);

router.get(
    '/duplicate-check/:groupId',
    validate({ params: groupIdOnlyParamsSchema, query: duplicateCheckQuerySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('MEMBER', 'ADMIN', 'SUPER_ADMIN'),
    checkDuplicateExpense
);

router.get('/paymentMethods', verifyToken, paymentMethods);

router.get(
    '/expensereport/:groupId',
    validate({ params: groupIdOnlyParamsSchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    expenseReport
);

router.get(
    '/allexpenses/:groupId',
    validate({ params: groupIdOnlyParamsSchema, query: allExpensesQuerySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    getAllExpenses
);

export default router;
