import type { CookieOptions, Response } from 'express';
import {
    userGroupsService,
    verifyUserService,
    searchUsersService,
    getUserByIdService,
    deleteAccountService,
} from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../helpers/AppError';
import { env } from '../config/env';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../config/constants';

const clearAuthCookies = (res: Response): void => {
    const opts: CookieOptions = {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: env.isProduction ? 'none' : 'lax',
        path: '/',
    };
    res.clearCookie(ACCESS_TOKEN_COOKIE, opts);
    res.clearCookie(REFRESH_TOKEN_COOKIE, opts);
};

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

export const DeleteAccount = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    await deleteAccountService(req.user._id);
    clearAuthCookies(res);
    sendSuccess(res, null, 'Account deleted successfully');
});
