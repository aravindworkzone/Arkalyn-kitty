import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../helpers/AppError';
import {
    mcpBalanceService,
    mcpExpensesService,
    mcpGroupDetailsService,
    mcpGroupActivityService,
    mcpMembersService,
    mcpSubscriptionService,
    mcpAddExpenseService,
    mcpAddCategoryService,
    mcpAddContributionService,
} from '../services/mcp.service';

// Handlers rely on apiKeyAuth having set req.user. The read handlers are
// read-only; the write handlers below resolve and authorize the target group
// inside the service before mutating.

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

// Parses ?limit. Absent/blank => undefined, meaning "no cap, return everything".
// A supplied value is used as-is (floored at 1); non-numeric input fails loudly
// rather than being silently treated as unlimited.
const parseLimitParam = (value: unknown): number | undefined => {
    if (value === undefined || (typeof value === 'string' && !value.trim())) return undefined;
    const n = Number(value);
    if (!Number.isFinite(n)) {
        throw new AppError('Invalid limit — must be a positive integer', 400);
    }
    return Math.max(Math.trunc(n), 1);
};

export const McpExpenses = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    // ?limit — honoured as given (floored at 1). Omitted or blank means no cap:
    // every expense matching the filters below is returned.
    const limit = parseLimitParam(req.query.limit);

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

export const McpGroupDetails = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const group = trimParam(req.query.group);
    if (!group) throw new AppError('group is required (name or group ID)', 400);

    const data = await mcpGroupDetailsService(req.user._id, group);
    sendSuccess(res, data, 'Group details fetched');
});

export const McpGroupActivity = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const group = trimParam(req.query.group);
    if (!group) throw new AppError('group is required (name or group ID)', 400);

    // Same limit semantics as /expenses: omitted means the whole timeline the
    // plan's retention window allows.
    const data = await mcpGroupActivityService(req.user._id, {
        group,
        limit: parseLimitParam(req.query.limit),
        from: parseDateParam(req.query.from, 'from'),
        to: parseDateParam(req.query.to, 'to'),
        kind: trimParam(req.query.kind),
    });
    sendSuccess(res, data, 'Group activity fetched');
});

export const McpMembers = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const data = await mcpMembersService(req.user._id);
    sendSuccess(res, data, 'Members fetched');
});

export const McpSubscription = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    // Group-scoped: plans belong to groups, so "which subscription" needs to
    // name one.
    const group = trimParam(req.query.group);
    if (!group) throw new AppError('group is required (name or group ID)', 400);

    const data = await mcpSubscriptionService(req.user._id, group);
    sendSuccess(res, data, 'Subscription fetched');
});

// ── Write handlers ─────────────────────────────────────────────────────────
// Each pulls its inputs from req.body; the service resolves the group from the
// caller's memberships and enforces status/role before writing.

export const McpAddExpense = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const { group, title, amount, category, paymentType, date, paidBy } = req.body ?? {};
    const data = await mcpAddExpenseService(req.user._id, {
        group, title, amount, category, paymentType, date, paidBy,
    });
    sendSuccess(res, data, 'Expense created', 201);
});

export const McpAddCategory = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const { group, name, color } = req.body ?? {};
    const data = await mcpAddCategoryService(req.user._id, { group, name, color });
    sendSuccess(res, data, 'Category created', 201);
});

export const McpAddContribution = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const { group, amount, member, description } = req.body ?? {};
    const data = await mcpAddContributionService(req.user._id, { group, amount, member, description });
    sendSuccess(res, data, 'Contribution added', 201);
});
