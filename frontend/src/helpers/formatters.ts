import { parseISODate } from "./date";

/**
 * A CALENDAR DAY ("YYYY-MM-DD"), rendered in local time.
 *
 * Separate from dateLabel below, which takes an instant. `new Date("2026-08-16")`
 * parses as UTC midnight, so a viewer west of Greenwich would see the 15th —
 * parseISODate builds the date from its parts instead. IST is +5:30 so en-IN
 * users happen never to notice, which is precisely how this bug ships.
 */
export const dayLabel = (isoDay: string | null | undefined) => {
  if (!isoDay) return "";
  const d = parseISODate(isoDay.slice(0, 10));
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const dateLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const timeLabel = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

export const eventDescription = (event: { eventType: string; metadata?: Record<string, any> }) => {
  const m = event.metadata || {};
  return m.note || "Group activity";
};
