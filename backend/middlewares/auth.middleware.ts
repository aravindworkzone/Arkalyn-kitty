import mongoose from 'mongoose';
import type { CookieOptions, Response } from 'express';
import Group from '../models/group.model';
import Member from '../models/group_member.model';
import User, { IUser } from '../models/user.model';
import { AppError } from '../helpers/AppError';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../config/constants';
import { verifyAccessToken } from '../services/session.service';
import { asyncHandler } from '../utils/asyncHandler';
import { env } from '../config/env';

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

const verifyToken = asyncHandler(async (req, res, next) => {
    const token = req.cookies[ACCESS_TOKEN_COOKIE];
    if (!token) {
        // No access token — the client should hit /auth/refresh to mint one
        // from its refresh-token cookie. Don't touch cookies here.
        throw new AppError('Unauthorized', 401);
    }

    let payload;
    try {
        payload = verifyAccessToken(token);
    } catch {
        // Expired/invalid access token. Leave the refresh-token cookie intact
        // so /auth/refresh can still issue a new pair.
        throw new AppError('Invalid or expired access token', 401);
    }

    // Enforce account status on every request. A suspended/deleted account is
    // turned away and its cookies cleared "on next request" — this is how a
    // suspension takes effect against an already-issued (still-valid) JWT.
    const user = await User.findById(payload.userId).select('role status');
    if (!user || user.status !== 'ACTIVE') {
        clearAuthCookies(res);
        throw new AppError(user?.status === 'SUSPENDED' ? 'Your account has been suspended' : 'Unauthorized', 401);
    }

    req.user = {
        _id: new mongoose.Types.ObjectId(payload.userId),
        role: user.role,
    } as unknown as IUser;
    next();
});

// Gate for the owner dashboard. Any non-APP_OWNER hitting an admin route gets 403.
const requireAppOwner = asyncHandler(async (req, _res, next) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if ((req.user as unknown as { role?: string }).role !== 'APP_OWNER') {
        throw new AppError('Forbidden', 403);
    }
    next();
});

const loadGroup = asyncHandler(async (req, _res, next) => {
    const rawId = req.body?.groupId ?? req.params?.groupId;
    const groupId = typeof rawId === 'string' ? rawId.trim() : null;
    if (!groupId) throw new AppError('Group ID is required', 400);

    const query = mongoose.isValidObjectId(groupId)
        ? { _id: groupId }
        : { displayId: groupId };

    const group = await Group.findOne(query);
    if (!group) throw new AppError('Group not found', 404);

    req.group = group;
    next();
});

const authorizeRole = (...roles: string[]) =>
    asyncHandler(async (req, _res, next) => {
        if (!req.user?._id) throw new AppError('Unauthorized', 401);
        if (!req.group?._id) throw new AppError('Group not found', 400);

        const member = await Member.findOne({
            groupId: req.group._id,
            userId: req.user._id,
            isDeleted: false,
        });

        if (!member) throw new AppError('Not a group member', 403);
        if (!roles.includes(member.role)) throw new AppError('Forbidden', 403);

        next();
    });

const ensureGroupActive = asyncHandler(async (req, _res, next) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (req.group.status === 'CLOSED') {
        throw new AppError('Group is closed — no further changes are allowed', 403);
    }
    next();
});

export { verifyToken, loadGroup, authorizeRole, ensureGroupActive, requireAppOwner };
