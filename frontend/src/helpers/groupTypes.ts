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
  // The only type that records ordinary spending.
  FAMILY: { expenses: true, fundOthers: false, receiveFunding: true, manualWalletMoves: true, chit: false },
  // The chit subsystem and nothing else: the wallet is owed to whoever is next in
  // the rotation, so there is no spending of its own to record — and no outside
  // funding either, since a funded rupee belongs to nobody in the rotation.
  CHIT: { expenses: false, fundOthers: false, receiveFunding: false, manualWalletMoves: false, chit: true },
  // Lends to Family groups as a credit line; never borrows — credit is spent
  // through expenses, and a Reserve records none.
  RESERVE: { expenses: false, fundOthers: true, receiveFunding: false, manualWalletMoves: true, chit: false },
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
    hint: "Only a chit fund — members contribute each cycle and take turns to receive the pot. No expenses of its own",
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

// Copy for the "this group records no expenses" screen, resolved from the type.
//
// Two types refuse expenses and they refuse them for different reasons, so one
// screen cannot serve both: a Reserve is told to spend in the group it funds, a
// Chit is told to keep everyday costs in a Family group. Telling a chit organiser
// about Reserve groups names a type they did not create and offers no way out.
//
// Mirrors expensesDeniedMessage in Backend/helpers/groupTypes.ts — same split,
// same reasons — so the screen and the 403 that would follow say the same thing.
// Returns i18n keys WITH English fallbacks, the t(key, default) shape used
// everywhere else here.
export const noExpensesCopy = (type: GroupType) =>
  type === "CHIT"
    ? {
        labelKey: "createExpense.chitLabel",
        label: "Chit group",
        titleKey: "createExpense.chitTitle",
        title: "This group only runs its chit",
        messageKey: "createExpense.chitMessage",
        message:
          "A Chit group's wallet is owed to whoever is next in the rotation, so it records no spending of its own. Keep everyday expenses in a Family group.",
      }
    : {
        labelKey: "createExpense.reserveLabel",
        label: "Reserve group",
        titleKey: "createExpense.reserveTitle",
        title: "This group doesn't record expenses",
        messageKey: "createExpense.reserveMessage",
        message:
          "A Reserve group holds funds for your other groups. Send money to a connected group and record the spending there.",
      };

// The i18n key for a group's type badge.
//
// Keyed on the RESOLVED type, never on the raw purpose: the locales carry
// groupType.FAMILY / CHIT / RESERVE only. Looking up groupType.ROOMMATES would
// miss and silently fall through to the English default, so a Tamil user would
// see "Family" on every legacy group while new groups translated correctly.
export const groupTypeI18nKey = (purpose?: GroupPurpose | null): string =>
  `groupType.${groupTypeOf(purpose)}`;