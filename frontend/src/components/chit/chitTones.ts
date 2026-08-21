import type { BadgeTone } from "../ui";
import type { ChitDueState, ChitPayoutState } from "../../interface/chit";

// Shared by the roster, the member's own status and the history log, so a due
// that reads MISSED in one place cannot read amber in another.
export const DUE_TONE: Record<ChitDueState, BadgeTone> = {
  PAID: "success",
  PENDING: "warning",
  MISSED: "error",
};

export const PAYOUT_TONE: Record<ChitPayoutState, BadgeTone> = {
  RECEIVED: "success",
  CURRENT: "brand",
  UPCOMING: "gray",
};
