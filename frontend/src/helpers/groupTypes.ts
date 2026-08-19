import {
  type GroupPurpose,
  type GroupType,
  type GroupTypeFeatures,
  type SelectableGroupPurpose,
} from "../interface/group";

// ⚠️ Keep in sync with Backend/config/groupTypeFeatures.ts.
//
// Duplicated by hand because there is no shared package between the two projects
// — the same arrangement as PUBLIC_PLANS in helpers/plans.ts. The single-group
// detail payload ships the server's resolved answer (`features`), so anything
// rendered inside a group should prefer that; this map is the fallback for
// surfaces that only have a purpose, such as the group-list cards and the create
// form.
export const GROUP_TYPE_FEATURES: Record<GroupType, GroupTypeFeatures> = {
  FAMILY: { expenses: true, fundOthers: false, chit: false },
  // Everything Family can do, plus the chit subsystem.
  CHIT: { expenses: true, fundOthers: false, chit: true },
  RESERVE: { expenses: false, fundOthers: true, chit: false },
};

// Resolves a stored purpose to the type whose features apply. Every legacy
// purpose (FRIENDS, ROOMMATES, TEAM, OTHER) lands on FAMILY, which is how those
// groups already behave.
// ⚠️ Keep in sync with Backend/config/groupTypeFeatures.ts → groupTypeOf.
export const groupTypeOf = (purpose?: GroupPurpose | null): GroupType =>
  purpose === "CHIT" ? "CHIT" : purpose === "RESERVE" ? "RESERVE" : "FAMILY";

export const groupFeaturesOf = (purpose?: GroupPurpose | null): GroupTypeFeatures =>
  GROUP_TYPE_FEATURES[groupTypeOf(purpose)];

// The three tiles on the create form, and the labels every other surface reuses.
// One list, so the form, the badges and the settings page can't drift — there
// were three separate copies of this before.
export const GROUP_TYPE_OPTIONS: {
  value: SelectableGroupPurpose;
  label: string;
  hint: string;
}[] = [
  {
    value: "FAMILY",
    label: "Family",
    hint: "Shared bills, groceries and everyday spending",
  },
  {
    value: "CHIT",
    label: "Chit",
    hint: "A chit fund — members contribute each cycle and take turns to receive the pot",
  },
  {
    value: "RESERVE",
    label: "Reserve",
    hint: "Holds money and funds your other groups. No expenses of its own",
  },
];

const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  FAMILY: "Family",
  CHIT: "Chit",
  RESERVE: "Reserve",
};

// Display label for any purpose, legacy values included. A legacy group reads as
// "Family" because that is the feature set it has — showing "Roommates" would
// name a type the app no longer has any concept of.
//
// This is the ENGLISH fallback. Prefer groupTypeI18nKey below and pass this as
// t()'s default, so a translated locale wins where it has the string.
export const groupTypeLabel = (purpose?: GroupPurpose | null): string =>
  GROUP_TYPE_LABELS[groupTypeOf(purpose)];

// The i18n key for a group's type badge.
//
// Keyed on the RESOLVED type, never on the raw purpose: the locales carry
// groupType.FAMILY / CHIT / RESERVE only. Looking up groupType.ROOMMATES would
// miss and silently fall through to the English default, so a Tamil user would
// see "Family" on every legacy group while new groups translated correctly.
export const groupTypeI18nKey = (purpose?: GroupPurpose | null): string =>
  `groupType.${groupTypeOf(purpose)}`;