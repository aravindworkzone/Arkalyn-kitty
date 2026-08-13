// Money crosses the API in cents (paise) — `totalCents`, `limitCents`,
// `spentCents`. The UI speaks rupees, so conversion lives here rather than
// being re-derived at each call site.

export const formatCents = (cents: number, locale = "en") =>
  new Intl.NumberFormat(locale === "ta" ? "ta-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

// Rupees typed into an amount field → cents. Empty/invalid input means the
// user cleared the field, which for an optional limit reads as "no limit".
export const rupeesToCents = (value: string): number | null => {
  const n = parseFloat(value);
  if (!value.trim() || isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
};

// Cents → the string an amount input expects. Whole rupees stay whole so a
// ₹1500 limit edits as "1500", not "1500.00".
export const centsToRupeeInput = (cents: number | null | undefined): string => {
  if (!cents || cents <= 0) return "";
  const rupees = cents / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
};

/* ── Category spend limits ─────────────────────────────────────────────
   A limit is a soft, group-wide lifetime cap on one expense category. It
   never blocks a spend — it only warns, so the states below drive tone,
   nothing else. */

// Spend is "near" the cap from 80% onwards, which is where the warning starts.
export const NEAR_LIMIT_RATIO = 0.8;

export type LimitState = "under" | "near" | "over";

export interface LimitStatus {
  limitCents: number;
  spentCents: number;
  // Negative once the cap is passed — callers show the overrun with Math.abs.
  remainingCents: number;
  // Uncapped, so an overrun is visible as >100 rather than pinned at 100.
  usedPct: number;
  state: LimitState;
}

// Returns null when the category has no limit set — the caller renders nothing.
export const limitStatus = (
  spentCents: number | null | undefined,
  limitCents: number | null | undefined
): LimitStatus | null => {
  if (!limitCents || limitCents <= 0) return null;
  const spent = spentCents ?? 0;
  const usedPct = (spent / limitCents) * 100;
  return {
    limitCents,
    spentCents: spent,
    remainingCents: limitCents - spent,
    usedPct,
    state: spent > limitCents ? "over" : usedPct >= NEAR_LIMIT_RATIO * 100 ? "near" : "under",
  };
};
