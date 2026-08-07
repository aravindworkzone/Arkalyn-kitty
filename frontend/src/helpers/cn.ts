/**
 * Joins class names, dropping falsy entries — the conditional-className pattern
 * the primitives use throughout. Deliberately not clsx: the whole need is three
 * lines and a dependency would be the larger cost.
 */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
    parts.filter(Boolean).join(" ");

export default cn;
