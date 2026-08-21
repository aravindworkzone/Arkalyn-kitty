import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../helpers/AppError';
import { assertGroupTypeFeature, expensesDeniedMessage } from '../helpers/groupTypes';
import type { GroupTypeFeatures } from '../config/groupTypeFeatures';
import type { GroupPurpose } from '../models/group.model';

// Blocks a route when the group's TYPE does not have the feature.
//
// Must run after loadGroup (it reads req.group.purpose) and after authorizeRole,
// for the same reason the plan gates do: a caller with no rights in the group
// should learn nothing about it, not even what kind of group it is. See the
// docblock in routes/groupLink.router.ts.
//
// Costs no query — loadGroup fetches the group unprojected, so purpose is
// already on req.group.
//
// This is a convenience, NOT the enforcement point. The real gate lives in the
// service, because the MCP server calls services directly and never passes
// through a router. Adding it here as well only buys an earlier, cheaper failure.
// `message` may be a function of the group's purpose, because more than one type
// can lack the same feature for different reasons — a Reserve and a Chit both
// refuse expenses, and a chit organiser told "a Reserve group does not record
// expenses" learns nothing about the group they are actually in. A plain string
// stays accepted for the gates whose answer is the same whatever the type.
type DenialMessage = string | ((purpose: GroupPurpose | null | undefined) => string);

export const requireGroupTypeFeature = (feature: keyof GroupTypeFeatures, message: DenialMessage) =>
    asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.group?._id) throw new AppError('Group not found', 400);
        const purpose = req.group.purpose;
        assertGroupTypeFeature(
            purpose,
            feature,
            typeof message === 'function' ? message(purpose) : message
        );
        next();
    });

// Recording spending is what a Reserve and a Chit group deliberately cannot do.
// The reason differs — a Reserve bankrolls other groups, a Chit owes its wallet
// to the next member in the rotation — so the message is resolved per request.
export const requireExpenseCapableGroup = requireGroupTypeFeature(
    'expenses',
    expensesDeniedMessage
);
