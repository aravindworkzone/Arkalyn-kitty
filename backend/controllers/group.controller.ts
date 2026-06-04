import {
    createGroupService,
    cloneGroupService,
    deleteGroupService,
    manageMemberService,
    inviteMemberService,
    manageAdminService,
    addContributionService,
    SettlementService,
    leaveGroupService,
    approveLeaveRequestService,
    rejectLeaveRequestService,
    cancelOwnLeaveRequestService,
    getGroupByIdService,
    getGroupMemberService,
    getLeftContributorsService,
    getBasicTransactionService,
    getTransactionService,
    getAllCreditsService,
    removeCreditService,
    getEventService,
    toggleFavoriteService,
} from '../services/group.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { AppError } from '../helpers/AppError';
import { paginationQuerySchema } from '../validators/common';
import { emitToGroup, SOCKET_EVENTS } from '../sockets';

export const createGroup = asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401);

    const data = {
        name: typeof req.body.name === 'string' ? req.body.name.trim() : '',
        invitees: Array.isArray(req.body.invitees) ? req.body.invitees : [],
        contribution: typeof req.body.contribution === 'number' ? req.body.contribution : 0,
        purpose: typeof req.body.purpose === 'string' ? req.body.purpose : 'OTHER',
        superAdmin: req.user._id.toString(),
    };

    const group = await createGroupService(data);
    sendCreated(res, { group }, 'Group created');
});

export const cloneGroup = asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const data = {
        sourceGroupId: req.group._id.toString(),
        name: typeof req.body.name === 'string' ? req.body.name.trim() : '',
        superAdmin: req.user._id.toString(),
    };

    const group = await cloneGroupService(data);
    sendCreated(res, { group }, 'Group cloned');
});

export const deleteGroup = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const displayId = req.group.displayId;
    const group = await deleteGroupService(req.group._id.toString());

    emitToGroup(displayId, SOCKET_EVENTS.GROUP_DELETED);

    sendSuccess(res, { group }, 'Group deleted');
});

export const manageMember = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await manageMemberService({
        group: req.group._id,
        user: req.user._id,
        action: req.body.action,
        Member: req.body.Member,
        contribution: req.body.contribution,
    });

    const event = req.body.action === 'add' ? SOCKET_EVENTS.GROUP_MEMBER_ADDED : SOCKET_EVENTS.GROUP_MEMBER_REMOVED;
    emitToGroup(req.group.displayId, event);

    sendSuccess(res, null, result ?? 'Member updated');
});

export const inviteMember = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await inviteMemberService({
        group: req.group._id,
        invitedBy: req.user._id,
        invitedUser: req.body.invitedUser,
    });

    // The invitee is reached in real time through their notification socket room;
    // no group-wide emit since membership only changes once they accept.
    sendSuccess(res, null, result);
});

export const manageAdmin = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await manageAdminService({
        group: req.group._id,
        user: req.user._id,
        action: req.body.action,
        member: req.body.member,
    });

    emitToGroup(req.group.displayId, SOCKET_EVENTS.GROUP_ROLE_CHANGED);

    sendSuccess(res, null, result ?? 'Admin updated');
});

export const addContribution = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const member = await addContributionService({
        group: req.group._id,
        userId: req.body.userId ?? req.user._id,
        contribution: req.body.contribution,
        description: req.body.description,
    });

    emitToGroup(req.group.displayId, SOCKET_EVENTS.GROUP_CONTRIBUTION_ADDED);

    sendSuccess(res, { member }, 'Contribution added');
});

export const Settlement = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await SettlementService({
        group: req.group._id,
        userId: req.user._id,
        settlement: req.body.settlement,
        member: req.body.member,
        balance: req.group.balance,
    });

    emitToGroup(req.group.displayId, SOCKET_EVENTS.GROUP_SETTLEMENT_COMPLETED);

    sendSuccess(res, null, result ?? 'Settlement completed');
});

export const leaveGroup = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const mode = req.body.mode === 'forfeit' ? 'forfeit' : 'settlement';
    const result = await leaveGroupService({
        group: req.group._id,
        user: req.user._id,
        mode,
    });

    // A real exit broadcasts a membership change; a pending leave request
    // broadcasts a request update so admins' Leave Requests tab refreshes live.
    if (result.left) {
        emitToGroup(req.group.displayId, SOCKET_EVENTS.GROUP_MEMBER_REMOVED);
    } else {
        emitToGroup(req.group.displayId, SOCKET_EVENTS.GROUP_LEAVE_REQUEST_UPDATED);
    }

    sendSuccess(res, { left: result.left }, result.message);
});

export const approveLeaveRequest = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await approveLeaveRequestService({
        group: req.group._id,
        admin: req.user._id,
        member: req.body.member,
        settlement: req.body.settlement,
        balance: req.group.balance,
    });

    emitToGroup(req.group.displayId, SOCKET_EVENTS.GROUP_MEMBER_REMOVED);
    emitToGroup(req.group.displayId, SOCKET_EVENTS.GROUP_SETTLEMENT_COMPLETED);

    sendSuccess(res, null, result);
});

export const rejectLeaveRequest = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await rejectLeaveRequestService({
        group: req.group._id,
        admin: req.user._id,
        member: req.body.member,
    });

    emitToGroup(req.group.displayId, SOCKET_EVENTS.GROUP_LEAVE_REQUEST_UPDATED);

    sendSuccess(res, null, result);
});

export const cancelOwnLeaveRequest = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await cancelOwnLeaveRequestService({
        group: req.group._id,
        user: req.user._id,
    });

    emitToGroup(req.group.displayId, SOCKET_EVENTS.GROUP_LEAVE_REQUEST_UPDATED);

    sendSuccess(res, null, result);
});

export const getGroupById = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const group = await getGroupByIdService(req.group._id, req.user._id);
    sendSuccess(res, { group }, 'Group fetched');
});

export const getGroupMember = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const members = await getGroupMemberService(req.group._id);
    sendSuccess(res, { members }, 'Members fetched');
});

export const getLeftContributors = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const members = await getLeftContributorsService(req.group._id);
    sendSuccess(res, { members }, 'Left contributors fetched');
});

export const getBasicTransaction = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const transactions = await getBasicTransactionService(req.group._id);
    sendSuccess(res, { transactions }, 'Transactions fetched');
});

export const getTransaction = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const { page = 1, limit = 20 } = paginationQuerySchema.parse(req.query);
    const { items, total } = await getTransactionService(req.group._id, page, limit);
    sendPaginated(res, items, total, page, limit, 'Transactions fetched');
});

export const getAllCredits = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const { page = 1, limit = 20 } = paginationQuerySchema.parse(req.query);
    const { items, total } = await getAllCreditsService(req.group._id, page, limit);
    sendPaginated(res, items, total, page, limit, 'Credits fetched');
});

export const removeCredit = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const creditId = typeof req.params.creditId === 'string' ? req.params.creditId : '';
    if (!creditId) throw new AppError('Credit ID required', 400);

    const credit = await removeCreditService({
        creditId,
        groupId: req.group._id,
        userId: req.user._id,
        reason: typeof req.body.reason === 'string' ? req.body.reason : undefined,
    });

    emitToGroup(req.group.displayId, SOCKET_EVENTS.GROUP_CONTRIBUTION_ADDED);

    sendSuccess(res, { credit }, 'Credit removed');
});

export const getEvent = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const events = await getEventService(req.group._id);
    sendSuccess(res, { events }, 'Events fetched');
});

export const toggleFavorite = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const result = await toggleFavoriteService({
        group: req.group._id,
        user: req.user._id,
        isFavorite: Boolean(req.body.isFavorite),
    });

    sendSuccess(res, result, 'Favorite updated');
});
