import {
    createJoinLinkService,
    getJoinLinkService,
    revokeJoinLinkService,
    previewJoinLinkService,
    joinViaLinkService,
} from '../services/joinLink.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AppError } from '../helpers/AppError';

export const createJoinLink = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const link = await createJoinLinkService({ group: req.group._id, createdBy: req.user._id });
    sendCreated(res, link, 'Join link created');
});

export const getJoinLink = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const link = await getJoinLinkService(req.group._id);
    sendSuccess(res, { link }, 'Join link fetched');
});

export const revokeJoinLink = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await revokeJoinLinkService({ group: req.group._id });
    sendSuccess(res, result, 'Join link revoked');
});

export const previewJoinLink = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const token = String(req.params.token ?? '');
    const preview = await previewJoinLinkService(token, req.user._id);
    sendSuccess(res, preview, 'Join link resolved');
});

export const joinViaLink = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const result = await joinViaLinkService({
        token: req.body.token,
        userId: req.user._id,
        contribution: req.body.contribution,
    });

    // No group emit here, matching acceptInviteService: the request isn't a
    // membership change yet, and the admins are told by notification. The group
    // room only hears about it once someone approves.
    sendCreated(res, result, result.message);
});
