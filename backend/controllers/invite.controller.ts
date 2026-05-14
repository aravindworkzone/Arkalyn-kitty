import { acceptInviteService, rejectInviteService } from '../services/invite.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../helpers/AppError';

export const acceptInvite = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const result = await acceptInviteService({
        inviteId: req.body.inviteId,
        userId: req.user._id,
        contribution: req.body.contribution,
    });

    sendSuccess(res, null, result);
});

export const rejectInvite = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const result = await rejectInviteService({
        inviteId: req.body.inviteId,
        userId: req.user._id,
    });

    sendSuccess(res, null, result);
});
