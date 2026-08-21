import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { AppError } from '../helpers/AppError';
import GroupMember from '../models/group_member.model';
import { emitToGroup, SOCKET_EVENTS } from '../sockets';
import {
    createChitSchemeService,
    updateChitSchemeService,
    activateChitSchemeService,
    rescheduleChitService,
    cancelChitSchemeService,
    reassignOrganizerService,
    getChitBoardService,
    getChitHistoryService,
} from '../services/chit.service';
import {
    markDuePaidService,
    unmarkDuePaidService,
    releasePayoutService,
} from '../services/chitMoney.service';

// emitToGroup is keyed on the displayId, not the ObjectId — that is what the
// socket room is named after. req.group carries both.
const announce = (req: { group?: { displayId?: string } }) => {
    if (req.group?.displayId) emitToGroup(req.group.displayId, SOCKET_EVENTS.CHIT_UPDATED);
};

// The caller's role in this group. authorizeRole has already proved they have
// one; this reads which, for the checks that distinguish the owner.
const roleOf = async (
    groupId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
): Promise<string> => {
    const member = await GroupMember.findOne({ groupId, userId, isDeleted: false }).select('role');
    return member?.role ?? 'MEMBER';
};

export const createChitScheme = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const scheme = await createChitSchemeService({
        groupId: req.group._id,
        createdBy: req.user._id,
        callerRole: await roleOf(req.group._id, req.user._id),
        amountPerMember: req.body.amountPerMember,
        startDate: req.body.startDate,
        cycleIntervalDays: req.body.cycleIntervalDays,
        dueDays: req.body.dueDays,
        organizerUserId: req.body.organizerUserId,
    });

    announce(req);
    sendCreated(res, scheme, 'Chit set up started');
});

export const updateChitScheme = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const scheme = await updateChitSchemeService({
        groupId: req.group._id,
        userId: req.user._id,
        amountPerMember: req.body.amountPerMember,
        startDate: req.body.startDate,
        cycleIntervalDays: req.body.cycleIntervalDays,
        dueDays: req.body.dueDays,
        participants: req.body.participants,
    });

    announce(req);
    sendSuccess(res, scheme, 'Chit setup updated');
});

export const activateChitScheme = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const scheme = await activateChitSchemeService({
        groupId: req.group._id,
        userId: req.user._id,
    });

    announce(req);
    sendSuccess(res, scheme, 'Chit started');
});

export const rescheduleChit = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const scheme = await rescheduleChitService({
        groupId: req.group._id,
        userId: req.user._id,
        startDate: req.body.startDate,
        cycleIntervalDays: req.body.cycleIntervalDays,
        dueDays: req.body.dueDays,
    });

    announce(req);
    sendSuccess(res, scheme, 'Chit schedule updated');
});

export const cancelChitScheme = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const scheme = await cancelChitSchemeService({
        groupId: req.group._id,
        userId: req.user._id,
        reason: req.body.reason,
    });

    announce(req);
    sendSuccess(res, scheme, 'Chit cancelled');
});

export const reassignChitOrganizer = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const scheme = await reassignOrganizerService({
        groupId: req.group._id,
        userId: req.user._id,
        organizerUserId: req.body.organizerUserId,
    });

    announce(req);
    sendSuccess(res, scheme, 'Chit organiser changed');
});

export const markChitDue = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await markDuePaidService({
        groupId: req.group._id,
        dueId: req.body.dueId,
        recordedBy: req.user._id,
        paymentType: req.body.paymentType,
    });

    announce(req);
    sendSuccess(res, result, 'Contribution recorded');
});

export const unmarkChitDue = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await unmarkDuePaidService({
        groupId: req.group._id,
        dueId: req.body.dueId,
        userId: req.user._id,
    });

    announce(req);
    sendSuccess(res, result, 'Contribution undone');
});

export const releaseChitPayout = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await releasePayoutService({
        groupId: req.group._id,
        cycleId: req.body.cycleId,
        userId: req.user._id,
        acknowledgeShortfall: req.body.acknowledgeShortfall,
    });

    announce(req);
    sendSuccess(res, result, 'Payout recorded');
});

export const getChitBoard = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    // validate() parses params/query for validation but only reassigns body, so
    // the coerced number does not stick — re-read it here.
    const raw = typeof req.query.cycle === 'string' ? Number(req.query.cycle) : undefined;
    const cycleNumber = raw !== undefined && Number.isInteger(raw) && raw > 0 ? raw : undefined;

    const board = await getChitBoardService({
        groupId: req.group._id,
        userId: req.user._id,
        role: await roleOf(req.group._id, req.user._id),
        cycleNumber,
    });

    sendSuccess(res, board, 'Chit fetched');
});

export const getChitHistory = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));

    const { items, total } = await getChitHistoryService({
        groupId: req.group._id,
        userId: req.user._id,
        // The log carries per-cycle collection figures, which are narrowed for a
        // plain MEMBER exactly as they are on the board.
        role: await roleOf(req.group._id, req.user._id),
        page,
        limit,
    });

    sendPaginated(res, items, total, page, limit, 'Chit history fetched');
});
