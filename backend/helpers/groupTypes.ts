import { AppError } from './AppError';
import {
    GROUP_TYPE_FEATURES,
    groupTypeOf,
    type GroupType,
    type GroupTypeFeatures,
} from '../config/groupTypeFeatures';
import type { GroupPurpose } from '../models/group.model';

// The features a group has, resolved from its stored purpose. Pure — no DB read.
//
// Unlike getGroupPlan, this needs no lookup of its own: `purpose` arrives on the
// group document every caller already holds. loadGroup fetches the group
// unprojected, so `req.group.purpose` is in hand on every authenticated request
// and a gate costs zero extra queries.
export const groupFeaturesOf = (purpose?: GroupPurpose | null): GroupTypeFeatures =>
    GROUP_TYPE_FEATURES[groupTypeOf(purpose)];

// Throws 403 when the group's type does not have the feature.
//
// 403, NOT 402 — and the distinction is load-bearing. Every plan gate throws 402
// because the answer to "why can't I?" is "buy the tier". A group type cannot be
// bought: a Chit group does not become a Family group by paying, so 402 would be
// a lie to the user. It would also corrupt the demand signal — the global error
// handler records every 402 to `paywall_hit`, and GET /api/admin/demand reads
// that as customers stating purchase intent. Type gates would show up there as
// demand for something that is not for sale, in the one dataset the product uses
// to decide where tier boundaries belong.
//
// The same line is already drawn for /reject and /revoke in groupLink.router.ts:
// refusing is never a paid action.
export const assertGroupTypeFeature = (
    purpose: GroupPurpose | null | undefined,
    feature: keyof GroupTypeFeatures,
    message: string
): void => {
    if (!groupFeaturesOf(purpose)[feature]) throw new AppError(message, 403);
};

// The wire shape sent to the client, mirroring toPlanView. The server ships the
// type it resolved rather than letting the client re-derive it from `purpose`, so
// the UI gates on the identical answer the API will enforce. Commit 3dfd6da
// exists because the two once disagreed on plans; this avoids repeating it.
export const toGroupTypeView = (purpose?: GroupPurpose | null): {
    type: GroupType;
    features: GroupTypeFeatures;
} => ({
    type: groupTypeOf(purpose),
    features: groupFeaturesOf(purpose),
});
