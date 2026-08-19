import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../helpers/AppError';
import { assertGroupTypeFeature } from '../helpers/groupTypes';
import type { GroupTypeFeatures } from '../config/groupTypeFeatures';

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
export const requireGroupTypeFeature = (feature: keyof GroupTypeFeatures, message: string) =>
    asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.group?._id) throw new AppError('Group not found', 400);
        assertGroupTypeFeature(req.group.purpose, feature, message);
        next();
    });

// Recording spending is what a Reserve group deliberately cannot do: it holds
// money for the groups it bankrolls rather than spending on its own account.
export const requireExpenseCapableGroup = requireGroupTypeFeature(
    'expenses',
    'A Reserve group holds funds for other groups and does not record its own expenses.'
);
