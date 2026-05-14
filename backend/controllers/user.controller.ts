import {
    userGroupsService,
    verifyUserService,
    searchUsersService,
    getUserByIdService,
} from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../helpers/AppError';

export const GetUser = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const user = await getUserByIdService(req.user._id);
    sendSuccess(res, { user }, 'User fetched successfully');
});

export const userGroups = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const groups = await userGroupsService(req.user._id);
    sendSuccess(res, { groups }, 'User groups');
});

export const SearchUsers = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const users = await searchUsersService(q, req.user._id);
    sendSuccess(res, { users }, 'Users fetched');
});

export const VerifyUser = asyncHandler(async (req, res) => {
    const user = await verifyUserService(req.body.email);
    sendSuccess(res, { user }, 'User verified successfully');
});
