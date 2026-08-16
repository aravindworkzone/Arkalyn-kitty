import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../helpers/AppError';
import { getGroupPlan, assertFeature } from '../helpers/planLimits';

// Gates the "custom" report range behind the group owner's plan. The presets —
// this_month, last_month and all_time — are free for everyone; only a
// hand-picked date range is paid. Mirrors the preset-resolution logic in
// report.service.ts: absent preset + a date param implies "custom"; absent
// preset + no dates implies "all_time".
// Must run after loadGroup so req.group is populated.
export const requireAdvancedReportRange = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.group?._id) throw new AppError('Group not found', 400);

        const preset = typeof req.query.preset === 'string' ? req.query.preset : undefined;
        const hasDates = Boolean(req.query.startDate || req.query.endDate);
        const effective = preset ?? (hasDates ? 'custom' : 'all_time');

        // Allowlist rather than "not custom": resolveRange treats any preset it
        // doesn't recognise as a custom range, so naming the free ones keeps this
        // gate correct even if that fallthrough or the validator's enum drifts.
        if (
            effective === 'this_month' ||
            effective === 'last_month' ||
            effective === 'all_time'
        ) {
            next();
            return;
        }

        // A closed group is frozen history that takes no new expenses, so the
        // month presets are meaningless on it and the UI offers only all_time and
        // custom. Leaving it with all_time alone would make a frozen group the one
        // place the range picker does nothing, so closed groups are exempt
        // regardless of the owner's tier.
        if (req.group.status === 'CLOSED') {
            next();
            return;
        }

        const groupPlan = await getGroupPlan(req.group._id);
        assertFeature(
            groupPlan,
            'advancedReportRange',
            'Custom report date ranges require a Pro or Premium plan.'
        );
        next();
    }
);

// Gates group-to-group funding links behind the plan of the owner of whichever
// group is acting. Applied to the write routes only — reading the connections
// list stays free so a lapsed plan can still see, and unwind, existing links.
// Must run after loadGroup.
export const requireGroupLinking = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.group?._id) throw new AppError('Group not found', 400);

        const groupPlan = await getGroupPlan(req.group._id);
        assertFeature(
            groupPlan,
            'linkGroups',
            'Connecting groups requires a Pro or Premium plan.'
        );
        next();
    }
);
