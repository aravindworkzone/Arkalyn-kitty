import type { GroupPurpose } from "../models/group.model";

// ─── Group types ──────────────────────────────────────────────────────────────
//
// A group's TYPE decides which features it has. It is derived from the stored
// `purpose` field rather than stored separately, because purpose already carries
// this meaning for every existing document — see the comment on GROUP_PURPOSES
// in models/group.model.ts for why the storage enum is wider than this list.
//
// Type is chosen at creation and never changes. There is no update route and no
// settings control: the features a group has are a property of what it IS, not a
// setting someone can flip. That immutability is what lets other subsystems trust
// the type without re-checking history (a Reserve group has never held an
// expense, so nothing has to be reconciled when the rule is enforced).
export const GROUP_TYPES = ["FAMILY", "CHIT", "RESERVE"] as const;
export type GroupType = typeof GROUP_TYPES[number];

// Resolves a stored purpose to the type whose features apply.
//
// THE ONE PLACE this mapping lives. No call site should compare `purpose`
// directly — the legacy values (FRIENDS, ROOMMATES, TEAM, OTHER) all resolve to
// FAMILY, and scattering that knowledge would mean every new gate has to
// rediscover it. A missing purpose also lands on FAMILY: documents that predate
// the field are ordinary pooled-wallet groups, and defaulting them to anything
// narrower would retroactively take features away.
export const groupTypeOf = (purpose?: GroupPurpose | null): GroupType =>
    purpose === "CHIT" ? "CHIT" : purpose === "RESERVE" ? "RESERVE" : "FAMILY";

export interface GroupTypeFeatures {
    // May record expenses, and may create EXPENSE categories.
    //
    // Gates CREATION only. A Reserve group that already carries expenses — the
    // purpose existed before it meant anything — keeps them readable and
    // editable, so a mistake can still be corrected or unwound. Freezing history
    // outright would strand money in a group with no way to fix it.
    expenses: boolean;

    // May be the SOURCE of a funding link: the group whose wallet bankrolls
    // another group's.
    //
    // Gates link FORMATION only (request + approve), never `/transfer`. A
    // transfer acts on a link that is already ACTIVE, so links approved before
    // this rule existed keep working with no grandfather flag and no migration.
    fundOthers: boolean;

    // Runs a chit fund: a fixed contribution per member per cycle, with one
    // member per cycle receiving the pot in an order fixed at setup.
    //
    // Gates every /api/chit route. Unlike the two flags above — which restrict
    // what an otherwise-ordinary group may do — this one ADDS a subsystem, so a
    // group without it has no chit data at all and the routes 404 nothing into
    // existence.
    chit: boolean;
}

// The capability map, keyed by type. Sits beside PLANS in config/constants.ts and
// works the same way: a flat boolean record, one row per type, read through one
// assertion helper (helpers/groupTypes.ts).
//
// Group type and plan tier are ORTHOGONAL axes and compose — a gate may need
// both `assertFeature(plan, 'linkGroups')` and
// `assertGroupTypeFeature(purpose, 'fundOthers')`. Type is intrinsic and
// immutable; tier is purchased and lapses. Folding one into the other would turn
// a 1-D map into a 2-D matrix for no gain.
//
// Every flag here gates something real. A flag that is true on every row is dead
// weight that reads like a promise — `contributionRequests` on the plan side is
// exactly that mistake, and the README calls it out as a known gap.
export const GROUP_TYPE_FEATURES: Record<GroupType, GroupTypeFeatures> = {
    FAMILY: { expenses: true, fundOthers: false, chit: false },

    // A chit fund. Everything a Family group can do, plus the chit subsystem:
    // members contribute a fixed amount each cycle and take turns receiving the
    // pot. Expenses stay on, because a chit group still has ordinary shared costs
    // and its wallet is the same wallet.
    CHIT: { expenses: true, fundOthers: false, chit: true },

    // A vault: contributions in, funding out to other groups. It holds money on
    // behalf of the groups it bankrolls, so it does not spend on its own account.
    RESERVE: { expenses: false, fundOthers: true, chit: false },
};
