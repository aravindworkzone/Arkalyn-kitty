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
