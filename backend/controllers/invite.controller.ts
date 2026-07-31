import {
    acceptInviteService,
    rejectInviteService,
    approveJoinService,
    declineJoinService,
    getPendingJoinRequestsService,
} from '../services/invite.service';
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

export const approveJoin = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await approveJoinService({
        group: req.group._id,
        inviteId: req.body.inviteId,
        reviewer: req.user._id,
    });

    sendSuccess(res, null, result);
});

export const declineJoin = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await declineJoinService({
        group: req.group._id,
        inviteId: req.body.inviteId,
        reviewer: req.user._id,
    });

    sendSuccess(res, null, result);
});

export const getPendingJoinRequests = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const requests = await getPendingJoinRequestsService(req.group._id);
    sendSuccess(res, { requests }, 'Join requests fetched');
});
