import mongoose from 'mongoose';
import Group from '../models/group.model';
import {
    requestLinkService,
    approveLinkService,
    rejectLinkService,
    sendToReserveService,
    setReserveLimitService,
    revokeLinkService,
    getGroupLinksService,
} from '../services/groupLink.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AppError } from '../helpers/AppError';
import { emitToGroup, SOCKET_EVENTS } from '../sockets';

/**
 * A link change alters state in BOTH groups, so both rooms get told. emitToGroup
 * is keyed by displayId, which the link only carries as ids — hence the lookup.
 */
const announce = async (
    a: mongoose.Types.ObjectId | string,
    b: mongoose.Types.ObjectId | string
) => {
    const groups = await Group.find({ _id: { $in: [a, b] } }).select('displayId');
    groups.forEach((g) => emitToGroup(g.displayId, SOCKET_EVENTS.GROUP_LINK_UPDATED));
};

export const requestLink = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const link = await requestLinkService({
        hostGroup: req.group._id,
        sourceGroupRef: req.body.sourceGroupRef,
        requestedBy: req.user._id,
    });

    await announce(link.hostGroupId, link.sourceGroupId);
    sendCreated(res, link, 'Connection requested');
});

export const approveLink = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const link = await approveLinkService({
        sourceGroup: req.group._id,
        linkId: req.body.linkId,
        reviewer: req.user._id,
    });

    await announce(link.hostGroupId, link.sourceGroupId);
    sendSuccess(res, link, 'Connection approved');
});

export const rejectLink = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const link = await rejectLinkService({
        sourceGroup: req.group._id,
        linkId: req.body.linkId,
        reviewer: req.user._id,
    });

    await announce(link.hostGroupId, link.sourceGroupId);
    sendSuccess(res, link, 'Connection rejected');
});

export const setReserveLimit = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await setReserveLimitService({
        reserveGroup: req.group._id,
        creditLimit: req.body.creditLimit,
        performedBy: req.user._id,
    });

    // The Reserve and every group borrowing from it see new available credit.
    const groups = await Group.find({ _id: { $in: [req.group._id, ...result.hostGroupIds] } }).select('displayId');
    groups.forEach((g) => emitToGroup(g.displayId, SOCKET_EVENTS.GROUP_LINK_UPDATED));
    sendSuccess(res, { creditLimit: result.creditLimit }, 'Credit limit updated');
});

export const sendToReserve = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const link = await sendToReserveService({
        hostGroup: req.group._id,
        linkId: req.body.linkId,
        amount: req.body.amount,
        performedBy: req.user._id,
    });

    if (link) await announce(link.hostGroupId, link.sourceGroupId);
    sendSuccess(res, link, 'Money sent to the Reserve');
});

export const revokeLink = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const link = await revokeLinkService({
        group: req.group._id,
        linkId: req.body.linkId,
        performedBy: req.user._id,
    });

    await announce(link.hostGroupId, link.sourceGroupId);
    sendSuccess(res, link, 'Connection removed');
});

export const getGroupLinks = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const links = await getGroupLinksService(req.group._id);
    sendSuccess(res, links, 'Connections fetched');
});
