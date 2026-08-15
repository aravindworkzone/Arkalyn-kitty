/**
 * The step-2 choices from the last expense saved in a group, remembered so the
 * next one starts where the last one left off.
 *
 * Almost every group pays the same way every time — one payer, one payment
 * type, the same people in the split — so re-picking all of it per expense is
 * pure repetition. There is no server-side notion of this and adding one would
 * mean a schema change for a convenience, so it lives in localStorage, per
 * group, exactly like hooks/useRecentGroups.ts keeps recency locally.
 *
 * NOTHING HERE IS TRUSTED. It is user-writable via devtools and can also just
 * be stale — a remembered payer may have left the group, a remembered credit
 * pool may be deleted. Every value is shape-checked on read and the caller
 * re-validates the ids against live data before applying them.
 *
 * localStorage is guarded the way useTheme guards it: it throws in some
 * private/embedded contexts, and a convenience is never worth a broken render.
 */

/** Bumped when the shape changes; a mismatch is treated as absent, not migrated. */
const VERSION = 1;

const keyFor = (groupId: string): string => `expense:defaults:${groupId}`;

export interface ExpenseDefaults {
    paymentType?: string;
    /** User id, not the group-membership id. */
    paidBy?: string;
    splitMode?: "off" | "equal" | "custom";
    /** User ids. Amounts are deliberately not remembered — they follow the new amount. */
    splitUserIds?: string[];
    creditCategoryId?: string;
    /** "" means the group's own wallet. */
    fundedByGroup?: string;
}

const isString = (v: unknown): v is string => typeof v === "string";

export const readExpenseDefaults = (groupId: string): ExpenseDefaults | null => {
    try {
        const raw = localStorage.getItem(keyFor(groupId));
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return null;

        const o = parsed as Record<string, unknown>;
        if (o.v !== VERSION) return null;

        const mode = o.splitMode;
        return {
            paymentType: isString(o.paymentType) ? o.paymentType : undefined,
            paidBy: isString(o.paidBy) ? o.paidBy : undefined,
            splitMode:
                mode === "off" || mode === "equal" || mode === "custom" ? mode : undefined,
            splitUserIds: Array.isArray(o.splitUserIds)
                ? o.splitUserIds.filter(isString)
                : undefined,
            creditCategoryId: isString(o.creditCategoryId) ? o.creditCategoryId : undefined,
            fundedByGroup: isString(o.fundedByGroup) ? o.fundedByGroup : undefined,
        };
    } catch {
        return null;
    }
};

export const writeExpenseDefaults = (groupId: string, defaults: ExpenseDefaults): void => {
    try {
        localStorage.setItem(keyFor(groupId), JSON.stringify({ v: VERSION, ...defaults }));
    } catch {
        /* the next expense just starts from the plain defaults */
    }
};

export const clearExpenseDefaults = (groupId: string): void => {
    try {
        localStorage.removeItem(keyFor(groupId));
    } catch {
        /* nothing to do — the caller only wanted them gone */
    }
};
