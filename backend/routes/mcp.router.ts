import express from 'express';
import { apiKeyAuth } from '../middlewares/apiKeyAuth.middleware';
import {
    McpBalance,
    McpExpenses,
    McpMembers,
    McpSubscription,
} from '../controllers/mcp.controller';

const router = express.Router();

// Every /api/mcp/* route is API-key authenticated and READ-ONLY (GET only).
// No POST/PUT/PATCH/DELETE is mounted here by design — a personal API key can
// never mutate data.
router.use(apiKeyAuth);

router.get('/balance', McpBalance);
router.get('/expenses', McpExpenses);
router.get('/members', McpMembers);
router.get('/subscription', McpSubscription);

export default router;
