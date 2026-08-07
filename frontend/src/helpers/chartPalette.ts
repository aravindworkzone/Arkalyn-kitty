/**
 * The one categorical colour sequence.
 *
 * Category colours are user data — a category stores a single hex that has to
 * read correctly on BOTH the light and the dark canvas, so there is one
 * sequence rather than a per-theme pair. It is also what the reports colour
 * their series by, which is why it lives here rather than inside a screen.
 *
 * VALIDATED, not eyeballed. All six checks pass in both modes:
 *   light  (surface #ffffff)  — lightness band, chroma floor, CVD separation,
 *   dark   (surface #0d111a)    normal-vision floor, contrast ≥ 3:1
 *
 * THE ORDER IS LOAD-BEARING. The CVD check runs on *adjacent* pairs, and this
 * ordering is the one that clears it — it alternates blue-family and
 * warm-family hues so no two neighbours collapse together under deuteranopia.
 * Reordering, inserting, or appending a 9th hue invalidates that: re-run
 * `validate_palette.js` (dataviz skill) for both modes before changing it.
 *
 * Steps are 500–700 off the design-system ramps rather than the 400s: the
 * lighter steps fall under 3:1 against white and fail the contrast check.
 */
export const CATEGORICAL = [
  "#465fff", // brand-500
  "#dc6803", // warning-600
  "#6938ef", // purple-600
  "#039855", // success-600
  "#0086c9", // blue-light-600
  "#b54708", // warning-700
  "#dd2590", // pink-600
  "#175cd3", // blue-700
] as const;

/**
 * Colour for series `i`. Assigns in fixed order and deliberately does NOT cycle
 * past the end — a 9th series must fold into an "Other" bucket instead of
 * reusing hue 1, which would read as "same entity".
 */
export const seriesColor = (i: number): string =>
  CATEGORICAL[i] ?? "#667085"; // gray-500 — the "Other" bucket
