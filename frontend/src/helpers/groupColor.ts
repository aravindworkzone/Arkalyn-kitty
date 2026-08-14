import { CATEGORICAL } from "./chartPalette";

/**
 * A stable identity colour for a group's sidebar dot.
 *
 * Groups have no `color` field — unlike categories, which store a user-picked
 * hex. The dot exists purely so a group is recognisable at a glance in the
 * sidebar, so the colour is derived from the id and never persisted.
 *
 * Deliberately NOT `seriesColor()` from chartPalette: that function assigns by
 * position in a chart's series list and stops at the end of the ramp so a 9th
 * series falls into an "Other" bucket rather than reusing hue 1. Here the
 * opposite is right — every group must get a colour, and two groups sharing one
 * is harmless because the name sits next to it. Same palette, different rule.
 *
 * FNV-1a over the id: cheap, no dependency, and stable across sessions and
 * devices, which a random or index-based assignment would not be — a group must
 * not change colour because another group was created before it.
 */
export const groupColor = (id: string | undefined | null): string => {
    if (!id) return CATEGORICAL[0];

    let hash = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
        hash ^= id.charCodeAt(i);
        // 32-bit FNV prime multiply, written as shifts so it stays in int range.
        hash = Math.imul(hash, 0x01000193);
    }

    // `>>> 0` first: the multiply above leaves a signed 32-bit value, and a
    // negative operand would make `%` return a negative index.
    return CATEGORICAL[(hash >>> 0) % CATEGORICAL.length];
};

export default groupColor;
