import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import Group from '../models/group.model';
import Member from '../models/group_member.model';
import { IUser } from '../models/user.model';
import { AppError } from '../helpers/AppError';
import { env } from '../config/env';
import { COOKIE_NAME } from '../config/constants';
import { asyncHandler } from '../utils/asyncHandler';

const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
        next(new AppError('Unauthorized', 401));
        return;
    }

    try {
        req.user = jwt.verify(token, env.JWT_SECRET) as IUser;
        next();
    } catch (error) {
        res.clearCookie(COOKIE_NAME);
        next(error);
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
