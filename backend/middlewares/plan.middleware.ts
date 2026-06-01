import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../helpers/AppError';
import { getGroupOwnerPlan, assertFeature } from '../helpers/planLimits';

// Gates the "all time" and "custom" report ranges behind the group owner's plan.
// The month presets (this_month / last_month) are free for everyone. Mirrors the
// preset-resolution logic in report.service.ts: absent preset + a date param
// implies "custom"; absent preset + no dates implies "all_time".
// Must run after loadGroup so req.group is populated.
export const requireAdvancedReportRange = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.group?._id) throw new AppError('Group not found', 400);

        const preset = typeof req.query.preset === 'string' ? req.query.preset : undefined;
        const hasDates = Boolean(req.query.startDate || req.query.endDate);
        const effective = preset ?? (hasDates ? 'custom' : 'all_time');

        if (effective === 'this_month' || effective === 'last_month') {
            next();
            return;
        }

        const ownerPlan = await getGroupOwnerPlan(req.group._id);
        assertFeature(
            ownerPlan,
            'advancedReportRange',
            'All-time and custom report ranges require a Pro or Premium plan.'
        );
        next();
    }
);
