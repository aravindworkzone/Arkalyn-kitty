import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../helpers/AppError';
import { categoryBreakdownService } from '../services/report.service';
import { categoryBreakdownQuerySchema } from '../validators/report.validator';

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
