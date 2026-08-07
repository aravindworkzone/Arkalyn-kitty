import { CATEGORICAL } from "./chartPalette";
import type { Tone } from "./tone";

export const roleGrade: Record<string, string> = {
  SUPER_ADMIN:
    "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-500/10 dark:text-brand-300",
  ADMIN:
    "border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-400/30 dark:bg-warning-500/10 dark:text-warning-300",
  MEMBER:
    "border-line-strong bg-surface-hover text-fg-muted",
};

// Maps the API's role enum onto the `roles.*` i18n namespace.
export const roleNs: Record<string, string> = {
  SUPER_ADMIN: "superAdmin",
  ADMIN: "admin",
  MEMBER: "member",
};

export const roleLabel = (role: string): string =>
  role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// The category colour picker offers exactly the categorical sequence — one
// source, so a chart series and its category chip are never a different colour.
// See helpers/chartPalette.ts before changing the order.
// `string[]`, not the literal union CATEGORICAL carries — a category's colour
// can also be a custom hex from the picker, so the type must stay open.
export const colorOptions: string[] = [...CATEGORICAL];

// Ledger action → status tone. The concrete classes live in helpers/tone.ts;
// these are semantic assignments, not colours.
export const actionTone: Record<string, Tone> = {
  CREDIT: "success",
  DEBIT:  "error",
  REFUND: "warning",
};

export const eventConfig: Record<string, { label: string; icon: React.ReactNode; tone: Tone }> = {
  CREATE_GROUP:    { label: "Group created",    tone: "brand",   icon: <path d="M2 7h10M7 2v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/> },
  MEMBER_ADDED:    { label: "Member added",     tone: "success", icon: <><circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 11c0-2.5 2-4 5-4s5 1.5 5 4M10 6l1.5 1.5L13 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></> },
  MEMBER_REMOVED:  { label: "Member removed",   tone: "error",   icon: <><circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 11c0-2.5 2-4 5-4s5 1.5 5 4M10 7h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></> },
  MANAGE_CATEGORY: { label: "Category updated", tone: "brand",   icon: <path d="M2 3h4v4H2zM8 3h4v4H8zM2 9h4v4H2zM8 9h4v4H8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/> },
  CHANGE_ROLE:     { label: "Role changed",     tone: "warning", icon: <path d="M2 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/> },
  CREDIT_REMOVED:  { label: "Credit removed",   tone: "error",   icon: <path d="M2 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/> },
  EXPENSE_EDITED:  { label: "Expense edited",   tone: "info",    icon: <path d="M9 2.5l2.5 2.5M2 12l1-3.5L9.5 2A1.2 1.2 0 0111 3.5L4.5 10 1 11l1-3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/> },
};
