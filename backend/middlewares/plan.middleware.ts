import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../helpers/AppError';
import GroupLink from '../models/group_link.model';
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
            'Custom report date ranges require a Pro or Organization plan.'
        );
        next();
    }
);

// Funding links are paid for by the group RECEIVING the money, never by the one
// sending it. A reserve group can sit on Free and still bankroll others — it is
// giving money away, and charging for that would be charging for generosity.
// What costs money is being funded: the host's wallet grows, its ledger carries
// the incoming credits, and its expenses gain the funder attribution.
//
// Two middlewares because the host is identified differently depending on the
// route. On /request the acting group IS the host, so its plan is the one to
// read. On /approve and /transfer the acting group is the SOURCE, so the host
// has to be recovered from the link.
//
// Both must run after loadGroup, and after authorizeRole — a plan check that
// ran first would answer "is that group paid?" (and, below, "does that link
// exist?") for anyone who could guess an id.

// /request — the acting group is asking to be funded, so it is the host.
export const requireGroupLinking = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.group?._id) throw new AppError('Group not found', 400);

        const groupPlan = await getGroupPlan(req.group._id);
        assertFeature(
            groupPlan,
            'linkGroups',
            'Receiving funding from another group requires a Pro or Organization plan.'
        );
        next();
    }
);

// /approve and /transfer — the acting group is the source, so the plan that
// matters belongs to the counterpart named on the link.
//
// This is a plan check only. Whether the acting group is really the link's
// source stays with the service, which is the security boundary; loading the
// link here is just how the host is found.
export const requireLinkHostPlan = asyncHandler(
    async (req: Request, _res: Response, next: NextFunction) => {
        const linkId = req.body?.linkId;
        if (!linkId || !mongoose.isValidObjectId(linkId)) {
            throw new AppError('Connection not found', 404);
        }

        const link = await GroupLink.findOne({ _id: linkId, isDeleted: false }).select('hostGroupId');
        if (!link) throw new AppError('Connection not found', 404);

        const hostPlan = await getGroupPlan(link.hostGroupId);
        assertFeature(
            hostPlan,
            'linkGroups',
            "The group being funded is on the Free plan. It needs Pro or Organization to receive funding from another group."
        );
        next();
    }
);
