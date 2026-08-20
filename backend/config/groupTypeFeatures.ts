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
    // May record expenses, and may create EXPENSE categories. FAMILY only —
    // both Reserve and Chit hold money that is spoken for elsewhere.
    //
    // Gates CREATION only. A group that already carries expenses — a Reserve from
    // before the purpose meant anything, or a Chit created while this flag was
    // still true — keeps them readable and editable, so a mistake can still be
    // corrected or unwound. Freezing history outright would strand money in a
    // group with no way to fix it.
    expenses: boolean;

    // May be the SOURCE of a funding link: the group whose wallet bankrolls
    // another group's.
    //
    // Gates link FORMATION only (request + approve), never `/transfer`. A
    // transfer acts on a link that is already ACTIVE, so links approved before
    // this rule existed keep working with no grandfather flag and no migration.
    fundOthers: boolean;

    // May be the HOST of a funding link: the group whose wallet is bankrolled by
    // another group's.
    //
    // The mirror of fundOthers, and false only for CHIT. A chit balances because
    // each member pays in exactly what they take out; a rupee arriving from
    // outside belongs to nobody in the rotation, so somebody would end the term
    // having taken out more than they put in. Family and Reserve both accept
    // funding — a Reserve can legitimately be topped up by another Reserve.
    //
    // Gates link FORMATION only, exactly like fundOthers, so links approved
    // before this rule keep working with no flag and no migration.
    receiveFunding: boolean;

    // May move money into or out of the wallet BY HAND: an admin recording a
    // contribution for a member, or a settlement paying one out.
    //
    // False only for CHIT, and it closes the last two doors into a chit's wallet.
    // A hand-recorded contribution belongs to nobody in the rotation, and a
    // settlement pays out money already promised to the next recipient — both
    // break the identity the term rests on. Worse, adjustMemberContribution is
    // shared: a manual top-up and a chit due bump the SAME field, so once one
    // lands the two are indistinguishable, and that field is what the close
    // refund is proportional to.
    //
    // A type rule, not a scheme-state one. It holds even between chits, because a
    // top-up recorded while no scheme is running would still be sitting in
    // member.contribution when the next one starts — and because the sidebar and
    // the settings tabs cannot see scheme state to hide themselves.
    manualWalletMoves: boolean;

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
    // The pooled-wallet baseline: everything the app did before types existed,
    // and the only type that records ordinary spending.
    FAMILY: { expenses: true, fundOthers: false, receiveFunding: true, manualWalletMoves: true, chit: false },

    // A chit fund, and ONLY a chit fund. Members contribute a fixed amount each
    // cycle and take turns receiving the pot; that is the whole group.
    //
    // `expenses: false` is the deliberate part. A chit group's wallet is not a
    // shared spending pot — every rupee in it is owed to whoever is next in the
    // rotation, and the term only balances because each member pays in exactly
    // what they take out. An ordinary expense would spend money the rotation has
    // already promised to someone, so a later payout would be short for a reason
    // that has nothing to do with the chit. Households that want both keep a
    // Family group beside the chit; the two wallets stay separate, which is the
    // honest shape.
    CHIT: { expenses: false, fundOthers: false, receiveFunding: false, manualWalletMoves: false, chit: true },

    // A vault: contributions in, funding out to other groups. It holds money on
    // behalf of the groups it bankrolls, so it does not spend on its own account.
    RESERVE: { expenses: false, fundOthers: true, receiveFunding: true, manualWalletMoves: true, chit: false },
};
