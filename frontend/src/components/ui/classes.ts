/**
 * Class strings for call sites that style a bare <input> themselves rather than
 * using the <Input> primitive. Kept in sync with Input.tsx by hand — if you
 * change one, change the other.
 *
 * INPUT_CLASS_LG and FIELD_LABEL were dead exports (zero consumers) and have
 * been removed.
 */
export const INPUT_CLASS =
  "w-full rounded-lg border px-4 py-2.5 text-theme-sm shadow-theme-xs transition " +
  "bg-white text-gray-800 placeholder:text-gray-400 " +
  "dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500 " +
  "border-gray-300 dark:border-gray-700 " +
  "outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 " +
  "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 " +
  "dark:disabled:bg-gray-900/50 dark:disabled:text-gray-600";

// Makes a native <input type="date"> blend in: `color-scheme` gives the picker
// popup and the calendar glyph the right theme; the rest tints the icon and
// makes it feel interactive.
//
// Was pinned to `[color-scheme:dark]` unconditionally; now follows the theme.
export const DATE_INPUT_EXTRA =
  "[color-scheme:light] dark:[color-scheme:dark] " +
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer " +
  "[&::-webkit-calendar-picker-indicator]:opacity-50 " +
  "[&::-webkit-calendar-picker-indicator]:transition-opacity " +
  "[&::-webkit-calendar-picker-indicator]:hover:opacity-90";
