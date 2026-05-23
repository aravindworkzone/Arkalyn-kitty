/**
 * Tour step definitions.
 *
 * Each step points at a `data-tour="<target>"` element somewhere in the app
 * and ships a short tooltip that explains what to do. The overlay watches
 * the DOM for the target — when it appears the spotlight + tooltip snap to
 * it; when it isn't mounted (e.g. user is mid-navigation) the overlay
 * quietly waits, then re-attaches once the user lands on a screen that has
 * the target.
 *
 * Two kinds of step:
 *   • button targets — clicking the target advances the tour.
 *   • input targets (`manualAdvance: true`) — clicking just focuses the
 *     input; the tooltip shows a "Next" button so the user can continue
 *     after typing.
 */
export interface TourStep {
  /** Stable identifier (also useful for tests / analytics). */
  id: string;
  /** Value of the `data-tour` attribute on the target element. */
  target: string;
  /** Short headline shown above the tip. */
  title: string;
  /** Tooltip body — keep to one or two sentences. */
  tip: string;
  /** Accessibility label for the spotlight container. */
  ariaLabel: string;
  /**
   * When `true`, clicking the highlighted target does NOT advance the tour
   * (used for text inputs — clicking focuses the field). The tooltip will
   * render a Next button instead.
   */
  manualAdvance?: boolean;
  /**
   * When `true`, the overlay does not paint the dim layer or lift the target
   * via z-index. Use this for targets inside another stacking context
   * (e.g. an open modal) where lifting via z-index would be clamped — the
   * target is highlighted via a glow outline applied directly to the element
   * and clicks on the surrounding chrome (like the modal's Close button)
   * still pass through normally.
   */
  noSpotlight?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  // ── Group creation ───────────────────────────────────────────────
  {
    id: "create-group",
    target: "create-group",
    title: "Create a group",
    tip: "Start here. A group is the shared wallet that everyone contributes to.",
    ariaLabel: "Create a group",
  },
  {
    id: "group-name-field",
    target: "group-name-field",
    title: "Enter the group name",
    tip: "Give your group a short, recognisable name (e.g. \"Goa Trip\" or \"Apartment 3B\").",
    ariaLabel: "Group name",
    manualAdvance: true,
  },
  {
    id: "group-members-field",
    target: "group-members-field",
    title: "Add member emails",
    tip: "Type a teammate's email and press Add. You can invite more than one.",
    ariaLabel: "Add members",
    manualAdvance: true,
  },
  {
    id: "create-group-submit",
    target: "create-group-submit",
    title: "Create the group",
    tip: "Once the name and members look right, click Create Group.",
    ariaLabel: "Submit new group",
  },

  // ── Open the new group ───────────────────────────────────────────
  {
    id: "open-group",
    target: "open-group",
    title: "Open your group",
    tip: "Tap the group you just created to step inside and start setting it up.",
    ariaLabel: "Open group",
  },

  // ── Category creation ────────────────────────────────────────────
  {
    id: "create-category",
    target: "create-category",
    title: "Add a category",
    tip: "Categories organise expenses (food, travel, rent…). You need at least one to log spending.",
    ariaLabel: "Create a category",
  },
  {
    id: "category-name-field",
    target: "category-name-field",
    title: "Enter the category name",
    tip: "Type a label like \"Food\" or \"Travel\".",
    ariaLabel: "Category name",
    manualAdvance: true,
  },
  {
    id: "create-category-submit",
    target: "create-category-submit",
    title: "Add the category",
    tip: "Pick a colour if you'd like, then click Add.",
    ariaLabel: "Add category",
  },
  {
    id: "category-back",
    target: "category-back",
    title: "Head back to the group",
    tip: "Once your categories look good, hit Back to return to the group.",
    ariaLabel: "Back to group",
  },

  // ── Expense creation ─────────────────────────────────────────────
  {
    id: "create-expense",
    target: "create-expense",
    title: "Log an expense",
    tip: "Record money spent from the pool. Splits and payers are tracked automatically.",
    ariaLabel: "Create an expense",
  },
  {
    id: "expense-title-field",
    target: "expense-title-field",
    title: "Enter the expense title",
    tip: "What was the spend for? (e.g. \"Groceries\", \"Cab to airport\").",
    ariaLabel: "Expense title",
    manualAdvance: true,
  },
  {
    id: "expense-amount-field",
    target: "expense-amount-field",
    title: "Enter the amount",
    tip: "How much did it cost? It must not exceed the group's pool balance.",
    ariaLabel: "Expense amount",
    manualAdvance: true,
  },
  {
    id: "expense-category",
    target: "expense-category",
    title: "Pick a category",
    tip: "Choose the category that fits this spend, then click Next.",
    ariaLabel: "Choose expense category",
    manualAdvance: true,
  },
  {
    id: "expense-payment",
    target: "expense-payment",
    title: "Pick a payment type",
    tip: "Cash, card, UPI — choose how it was paid, then click Next.",
    ariaLabel: "Choose payment type",
    manualAdvance: true,
  },
  {
    id: "expense-paid-by",
    target: "expense-paid-by",
    title: "Who paid?",
    tip: "Tap the member who actually paid for this expense, then click Next.",
    ariaLabel: "Choose payer",
    manualAdvance: true,
  },
  {
    id: "expense-split",
    target: "expense-split",
    title: "Split between members",
    tip: "Tap each person the cost should be split across, then click Next.",
    ariaLabel: "Choose split members",
    manualAdvance: true,
  },
  {
    id: "expense-split-amounts",
    target: "expense-split-amounts",
    title: "Set each share",
    tip: "Enter how much each selected member owes. The totals must match the expense amount.",
    ariaLabel: "Set split amounts",
    manualAdvance: true,
  },
  {
    id: "create-expense-submit",
    target: "create-expense-submit",
    title: "Save the expense",
    tip: "Everything set? Click Save to record it.",
    ariaLabel: "Save expense",
  },

  // ── Activity (transactions & events) ─────────────────────────────
  {
    id: "view-report",
    target: "view-report",
    title: "Open the activity log",
    tip: "Click Activity to see every transaction and admin event for this group.",
    ariaLabel: "View activity",
  },
  {
    id: "activity-page",
    target: "activity-page",
    title: "Group activity at a glance",
    tip: "Totals in, out, and refunded — plus a filterable list of every credit, debit, and event below.",
    ariaLabel: "Activity overview",
    manualAdvance: true,
  },
  {
    id: "activity-back",
    target: "activity-back",
    title: "Head back to the group",
    tip: "Click Back to return to the group dashboard.",
    ariaLabel: "Back to group",
  },

  // ── Category breakdown report ────────────────────────────────────
  {
    id: "view-breakdown",
    target: "view-breakdown",
    title: "Open the breakdown",
    tip: "Click Breakdown to see spending grouped by category, member, and over time.",
    ariaLabel: "View category breakdown",
  },
  {
    id: "breakdown-page",
    target: "breakdown-page",
    title: "Spending insights",
    tip: "Switch between Category, By member, and Trend views — and pick a date range to focus on.",
    ariaLabel: "Breakdown overview",
    manualAdvance: true,
  },
  {
    id: "breakdown-back",
    target: "breakdown-back",
    title: "Head back to the group",
    tip: "Click Back to return to the group dashboard.",
    ariaLabel: "Back to group",
  },

  // ── Group settings ───────────────────────────────────────────────
  {
    id: "view-settings",
    target: "view-settings",
    title: "Open group settings",
    tip: "Click Settings to manage members, contributions, settlements, and more.",
    ariaLabel: "Open settings",
  },
  {
    id: "settings-addMember",
    target: "settings-addMember",
    title: "Add Member",
    tip: "Invite a new teammate by email. They'll appear here once they accept.",
    ariaLabel: "Add member tab",
    manualAdvance: true,
    noSpotlight: true,
  },
  {
    id: "settings-changeRole",
    target: "settings-changeRole",
    title: "Change Role",
    tip: "Promote a member to admin or hand off ownership of the group.",
    ariaLabel: "Change role tab",
    manualAdvance: true,
    noSpotlight: true,
  },
  {
    id: "settings-contribution",
    target: "settings-contribution",
    title: "Contribution",
    tip: "Top up the shared pool with a member's contribution.",
    ariaLabel: "Contribution tab",
    manualAdvance: true,
    noSpotlight: true,
  },
  {
    id: "settings-settlement",
    target: "settings-settlement",
    title: "Settlement",
    tip: "Settle up balances between members when the group winds down.",
    ariaLabel: "Settlement tab",
    manualAdvance: true,
    noSpotlight: true,
  },
  {
    id: "settings-leaveRequests",
    target: "settings-leaveRequests",
    title: "Leave Requests",
    tip: "Approve or reject members who've asked to leave the group.",
    ariaLabel: "Leave requests tab",
    manualAdvance: true,
    noSpotlight: true,
  },
  {
    id: "settings-danger",
    target: "settings-danger",
    title: "Danger Zone",
    tip: "Close the group, leave it, or delete it — only when you really mean it.",
    ariaLabel: "Danger zone tab",
    manualAdvance: true,
    noSpotlight: true,
  },
  {
    id: "settings-close",
    target: "settings-close",
    title: "Close the settings",
    tip: "All set — click the X to close the settings panel.",
    ariaLabel: "Close settings",
    noSpotlight: true,
  },
] as const;

export const TOUR_STEP_COUNT = TOUR_STEPS.length;
