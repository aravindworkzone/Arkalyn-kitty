import express from 'express';
import { apiKeyAuth } from '../middlewares/apiKeyAuth.middleware';
import {
    McpBalance,
    McpExpenses,
    McpMembers,
    McpSubscription,
    McpAddExpense,
    McpAddCategory,
    McpAddContribution,
} from '../controllers/mcp.controller';

const router = express.Router();

// Every /api/mcp/* route is API-key authenticated. The GET routes are
// read-only; the POST routes below let a key add expenses, categories, and
// contributions. Every write is scoped to the key owner's own groups and
// re-checks group status/role inside the service before mutating.
router.use(apiKeyAuth);

router.get('/balance', McpBalance);
router.get('/expenses', McpExpenses);
router.get('/members', McpMembers);
router.get('/subscription', McpSubscription);

router.post('/expenses', McpAddExpense);
router.post('/categories', McpAddCategory);
router.post('/contributions', McpAddContribution);

export default router;
