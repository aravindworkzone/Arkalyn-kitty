import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import Group from '../models/group.model';
import Member from '../models/group_member.model';
import { IUser } from '../models/user.model';
import { AppError } from '../helpers/AppError';
import { ACCESS_TOKEN_COOKIE } from '../config/constants';
import { verifyAccessToken } from '../services/session.service';
import { asyncHandler } from '../utils/asyncHandler';

const verifyToken = (req: Request, _res: Response, next: NextFunction): void => {
    const token = req.cookies[ACCESS_TOKEN_COOKIE];
    if (!token) {
        // No access token — the client should hit /auth/refresh to mint one
        // from its refresh-token cookie. Don't touch cookies here.
        next(new AppError('Unauthorized', 401));
        return;
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = {
            _id: new mongoose.Types.ObjectId(payload.userId),
            role: payload.role,
        } as unknown as IUser;
        next();
    } catch (error) {
        // Expired/invalid access token. Leave the refresh-token cookie intact
        // so /auth/refresh can still issue a new pair; cookie cleanup is the
        // job of the refresh/logout controllers.
        next(new AppError('Invalid or expired access token', 401));
    }
};

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

export { verifyToken, loadGroup, authorizeRole };
