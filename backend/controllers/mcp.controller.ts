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

// Parses a query param as a date, throwing 400 if present but unparseable so a
// malformed filter fails loudly instead of being silently ignored.
const parseDateParam = (value: unknown, name: string): Date | undefined => {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const d = new Date(value.trim());
    if (Number.isNaN(d.getTime())) {
        throw new AppError(`Invalid ${name} date — use ISO 8601 (e.g. 2026-01-31)`, 400);
    }
    return d;
};

const trimParam = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const McpExpenses = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    // ?limit — default 10, clamped to [1, MAX_LIMIT] so a client can't ask for
    // an unbounded scan.
    const raw = Number(req.query.limit);
    const limit = Number.isFinite(raw)
        ? Math.min(Math.max(Math.trunc(raw), 1), PAGINATION.MAX_LIMIT)
        : 10;

    // Optional server-side filters: ?from / ?to (date range), ?group, ?category.
    const data = await mcpExpensesService(req.user._id, {
        limit,
        from: parseDateParam(req.query.from, 'from'),
        to: parseDateParam(req.query.to, 'to'),
        group: trimParam(req.query.group),
        category: trimParam(req.query.category),
    });
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
