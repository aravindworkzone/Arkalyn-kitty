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
    getTitleSuggestions,
} from '../controllers/expense.controller';
import { verifyToken, authorizeRole, loadGroup, ensureGroupActive } from '../middlewares/auth.middleware';
import { requireExpenseCapableGroup } from '../middlewares/groupType.middleware';
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
    titleSuggestionsQuerySchema,
} from '../validators/expense.validator';

const router = express.Router();

// The group-type gate runs last, after authorizeRole — a caller with no rights in
// the group should not learn what kind of group it is. It is an early, cheap
// failure only: createExpenseService enforces the same rule, which is what covers
// the MCP server's add_expense tool (it calls the service directly and never
// passes through this router).
//
// Create only. Update and delete below are deliberately ungated, so a Reserve
// group that already carries expenses can still correct or unwind them.
router.post(
    '/create',
    validate({ body: createExpenseBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    requireExpenseCapableGroup,
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

router.get(
    '/title-suggestions/:groupId',
    validate({ params: groupIdOnlyParamsSchema, query: titleSuggestionsQuerySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('MEMBER', 'ADMIN', 'SUPER_ADMIN'),
    getTitleSuggestions
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
