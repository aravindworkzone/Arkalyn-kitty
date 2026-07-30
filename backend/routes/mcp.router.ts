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

router.use(apiKeyAuth);

router.get('/balance', McpBalance);
router.get('/expenses', McpExpenses);
router.get('/members', McpMembers);
router.get('/subscription', McpSubscription);

router.post('/expenses', McpAddExpense);
router.post('/categories', McpAddCategory);
router.post('/contributions', McpAddContribution);

export default router;
