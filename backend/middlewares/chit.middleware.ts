import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../helpers/AppError';
import GroupMember from '../models/group_member.model';
import ChitScheme from '../models/chit_scheme.model';

/**
 * Only the chit's organizer — or the group's SUPER_ADMIN — may record payments
 * and release payouts.
 *
 * WHY THIS IS NOT authorizeRole('SUPER_ADMIN', 'ADMIN').
 *
 * `defaultJoinRole` in helpers/planLimits.ts returns ADMIN whenever the group's
 * plan lacks the `memberRole` feature — which is every group on the Free plan. So
 * on Free, *everyone who joins is an ADMIN*, and a role-based gate here would let
 * any member of a chit mark themselves paid and then pay themselves the pot. The
 * organizer gate is the only thing standing between a Free chit group and that.
 *
 * SUPER_ADMIN passes as well, so a group is never stuck when its organizer goes
 * quiet. That is also why reassigning the organizer is a SUPER_ADMIN action.
 *
 * Runs AFTER authorizeRole, like every other gate here: a caller with no rights
 * in the group should not learn whether it runs a chit, or who runs it.
 */
export const requireChitOrganizer = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.group?._id) throw new AppError('Group not found', 400);
        if (!req.user?._id) throw new AppError('Unauthorized', 401);

        const scheme = await ChitScheme.findOne({
            groupId: req.group._id,
            status: { $in: ['DRAFT', 'ACTIVE'] },
            isDeleted: false,
        }).select('organizerUserId');

        if (scheme && String(scheme.organizerUserId) === String(req.user._id)) {
            next();
            return;
        }

        // No scheme yet is the setup case: there is no organizer to be, so the
        // group's owner is the one who may create one.
        const member = await GroupMember.findOne({
            groupId: req.group._id,
            userId: req.user._id,
            isDeleted: false,
        }).select('role');

        if (member?.role === 'SUPER_ADMIN') {
            next();
            return;
        }

        throw new AppError(
            scheme
                ? 'Only the chit organiser can do that.'
                : 'Only the group owner can set up a chit.',
            403
        );
    }
);
