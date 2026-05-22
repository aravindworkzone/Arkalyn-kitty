import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../helpers/AppError';
import {
    categoryBreakdownService,
    memberBreakdownService,
    spendTrendService,
} from '../services/report.service';
import {
    categoryBreakdownQuerySchema,
    reportRangeQuerySchema,
} from '../validators/report.validator';

export const categoryBreakdown = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const query = categoryBreakdownQuerySchema.parse(req.query);

    const result = await categoryBreakdownService({
        groupId: req.group._id,
        groupCreatedAt: req.group.createdAt ?? new Date(),
        preset: query.preset,
        startDate: query.startDate,
        endDate: query.endDate,
    });

    sendSuccess(res, result, 'Category breakdown');
});

export const memberBreakdown = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const query = reportRangeQuerySchema.parse(req.query);

    const result = await memberBreakdownService({
        groupId: req.group._id,
        groupCreatedAt: req.group.createdAt ?? new Date(),
        preset: query.preset,
        startDate: query.startDate,
        endDate: query.endDate,
    });

    sendSuccess(res, result, 'Member breakdown');
});

export const spendTrend = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const query = reportRangeQuerySchema.parse(req.query);

    const result = await spendTrendService({
        groupId: req.group._id,
        groupCreatedAt: req.group.createdAt ?? new Date(),
        preset: query.preset,
        startDate: query.startDate,
        endDate: query.endDate,
    });

    sendSuccess(res, result, 'Spend trend');
});
