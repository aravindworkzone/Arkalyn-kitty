/**
 * Local-time date helpers for the DatePicker.
 *
 * Pulled out of the component because this is pure logic worth testing on its
 * own, and because the timezone rule below is easy to reintroduce by accident
 * somewhere else.
 *
 * THE RULE: never hand an ISO date string to `new Date()`. `new Date("2026-07-31")`
 * is parsed as UTC midnight, which is 2026-07-30 17:00 for anyone west of
 * Greenwich — so the picker would highlight, and submit, the wrong day. Every
 * conversion here stays in local time.
 */

/** Parse `YYYY-MM-DD` as a LOCAL date. Returns null for anything malformed. */
export const parseISODate = (iso: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    const [, y, mo, d] = m;
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    // Rejects overflow like 2026-02-31, which Date would roll into March.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date;
};

/** Format a local Date as `YYYY-MM-DD`. Inverse of parseISODate. */
export const toISODate = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

export const addDays = (d: Date, n: number): Date =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Month arithmetic, normalised to the 1st so day-of-month never overflows. */
export const addMonths = (d: Date, n: number): Date =>
    new Date(d.getFullYear(), d.getMonth() + n, 1);

/**
 * Six full weeks (42 days) starting on the Sunday on or before the 1st, so the
 * calendar grid keeps a constant height and never reflows between months.
 */
export const monthGrid = (cursor: Date): Date[] => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};
