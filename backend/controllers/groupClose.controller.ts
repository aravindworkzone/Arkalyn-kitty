import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../helpers/AppError';
import {
    getGroupClosePreviewService,
    executeGroupCloseService,
} from '../services/groupClose.service';

export const getGroupClosePreview = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const preview = await getGroupClosePreviewService(req.group._id);
    sendSuccess(res, { preview }, 'Close preview fetched');
});

export const closeGroup = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const overrides = Array.isArray(req.body?.overrides) ? req.body.overrides : undefined;

    const result = await executeGroupCloseService({
        groupId: req.group._id,
        adminId: req.user._id,
        overrides,
    });

    sendSuccess(res, { result }, 'Group closed');
});
