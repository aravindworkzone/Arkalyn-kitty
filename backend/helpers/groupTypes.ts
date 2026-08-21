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

// Why THIS group cannot record expenses. Two types refuse expenses and they
// refuse them for different reasons, so one sentence cannot serve both: a Reserve
// holds money for the groups it bankrolls, while a Chit holds money the rotation
// has already promised to a member. Telling a chit organiser that "a Reserve
// group does not record expenses" names a type they did not create and offers no
// way forward.
//
// Keyed on the resolved type so a legacy purpose lands on the FAMILY branch,
// which is unreachable in practice — the caller only asks once the gate has
// already refused — but keeps the function total rather than needing a throw.
export const expensesDeniedMessage = (purpose?: GroupPurpose | null): string => {
    switch (groupTypeOf(purpose)) {
        case 'CHIT':
            return 'A Chit group only runs its chit fund. Its wallet is owed to whoever is next in the rotation, so it does not record spending of its own — keep everyday expenses in a Family group.';
        case 'RESERVE':
            return 'A Reserve group holds funds for other groups and does not record its own expenses.';
        default:
            return 'This group does not record expenses.';
    }
};

// Same message, phrased for the CATEGORY surface: the answer there is not "spend
// somewhere else" but "you wanted the other side of the ledger".
export const expenseCategoriesDeniedMessage = (purpose?: GroupPurpose | null): string =>
    `${expensesDeniedMessage(purpose)} Add a credit category instead.`;

// Why THIS group cannot be funded by another. Only CHIT refuses, so unlike
// expensesDeniedMessage there is one branch — but it stays a function so the
// sentence sits beside the flag it explains rather than inline at two call sites.
export const receiveFundingDeniedMessage = (name?: string | null): string =>
    `${name ? `"${name}"` : 'That group'} is a Chit group. A chit is funded only by its own members — outside money would belong to nobody in the rotation, so it cannot receive funding from another group.`;

// The two hand-operated money paths, refused for a chit. Separate sentences
// because they fail for opposite reasons — one puts money in that nobody owns,
// the other takes money out that is already owed.
export const contributionDeniedMessage = (): string =>
    'A Chit group collects only through its chit. Money added by hand would belong to nobody in the rotation, so record the contribution against its cycle on the chit page instead.';

export const settlementDeniedMessage = (): string =>
    'A Chit group cannot settle a member from the pool: the wallet is already owed to whoever is next in the rotation. Complete or cancel the chit first.';

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
