import {
    createGroupService,
    deleteGroupService,
    manageMemberService,
    manageAdminService,
    addContributionService,
    SettlementService,
    getGroupByIdService,
    getGroupMemberService,
    getBasicTransactionService,
    getTransactionService,
    getEventService,
} from '../services/group.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AppError } from '../helpers/AppError';

export const createGroup = asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401);

    const data = {
        name: typeof req.body.name === 'string' ? req.body.name.trim() : '',
        members: req.body.members,
        superAdmin: req.user._id.toString(),
    };

    const group = await createGroupService(data);
    sendCreated(res, { group }, 'Group created');
});

export const deleteGroup = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const group = await deleteGroupService(req.group._id.toString());
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

    sendSuccess(res, null, result ?? 'Member updated');
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

    sendSuccess(res, null, result ?? 'Admin updated');
});

export const addContribution = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const member = await addContributionService({
        group: req.group._id,
        userId: req.body.userId ?? req.user._id,
        contribution: req.body.contribution,
    });

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

    sendSuccess(res, null, result ?? 'Settlement completed');
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

export const getBasicTransaction = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const transactions = await getBasicTransactionService(req.group._id);
    sendSuccess(res, { transactions }, 'Transactions fetched');
});

export const getTransaction = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const transactions = await getTransactionService(req.group._id);
    sendSuccess(res, { transactions }, 'Transactions fetched');
});

export const getEvent = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const events = await getEventService(req.group._id);
    sendSuccess(res, { events }, 'Events fetched');
});
