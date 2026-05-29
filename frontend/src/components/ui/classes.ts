export const INPUT_CLASS =
  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 transition-all";

export const INPUT_CLASS_LG =
  "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200";

export const FIELD_LABEL =
  "block text-[10px] font-semibold text-white/40 mb-2 uppercase tracking-widest";

// Makes a native <input type="date"> blend with the dark UI: `color-scheme: dark`
// gives the picker popup a dark theme and lightens the calendar icon; the rest
// tints the icon and makes it feel interactive.
export const DATE_INPUT_EXTRA =
  "[color-scheme:dark] " +
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer " +
  "[&::-webkit-calendar-picker-indicator]:opacity-50 " +
  "[&::-webkit-calendar-picker-indicator]:transition-opacity " +
  "[&::-webkit-calendar-picker-indicator]:hover:opacity-90";
