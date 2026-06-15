import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../helpers/AppError';
import { PAGINATION } from '../config/constants';
import {
    mcpBalanceService,
    mcpExpensesService,
    mcpMembersService,
    mcpSubscriptionService,
} from '../services/mcp.service';

// All handlers are read-only and rely on apiKeyAuth having set req.user.

export const McpBalance = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const data = await mcpBalanceService(req.user._id);
    sendSuccess(res, data, 'Balances fetched');
});

export const McpExpenses = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    // ?limit — default 10, clamped to [1, MAX_LIMIT] so a client can't ask for
    // an unbounded scan.
    const raw = Number(req.query.limit);
    const limit = Number.isFinite(raw)
        ? Math.min(Math.max(Math.trunc(raw), 1), PAGINATION.MAX_LIMIT)
        : 10;

    const data = await mcpExpensesService(req.user._id, limit);
    sendSuccess(res, data, 'Expenses fetched');
});

export const McpMembers = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const data = await mcpMembersService(req.user._id);
    sendSuccess(res, data, 'Members fetched');
});

export const McpSubscription = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const data = await mcpSubscriptionService(req.user._id);
    sendSuccess(res, data, 'Subscription fetched');
});
