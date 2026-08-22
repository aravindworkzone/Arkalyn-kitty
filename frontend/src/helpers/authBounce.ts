/**
 * State for the "you were sent back to the login page" path.
 *
 * Two independent jobs, kept together because they share a lifetime:
 *
 * 1. **Why the bounce happened.** This used to be recorded only when
 *    `auth:hadSession` was set — i.e. only for someone who had already been
 *    signed in once in this tab. A first-time visitor whose session cookie never
 *    arrived was returned to the login page with nothing said at all, which is
 *    how a failure affecting everyone came to look like it only hit new users.
 *
 * 2. **How many times in a row.** Two hard navigations point at each other:
 *    page/Authentication.tsx sends an authenticated visitor to /groups, and
 *    redux/api/base.ts sends a 401 back to /login, both via
 *    `window.location.href`. If the session cookie is readable on one route and
 *    not the other, that is an infinite reload loop. Past `MAX_BOUNCES` we stop
 *    and let the login page explain itself instead.
 */

const REASON_KEY = "auth:bounceReason";
const COUNT_KEY = "auth:bounceCount";

export type BounceReason = "expired" | "failed";

/** Consecutive bounces tolerated before we stop redirecting and show the page. */
export const MAX_BOUNCES = 2;

// sessionStorage throws outright in a few environments (some embedded webviews,
// Safari with site data blocked). Auth must not be one of the things that breaks
// there, so every access degrades to "no record" rather than propagating.
const read = (key: string): string | null => {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
};

const write = (key: string, value: string): void => {
    try {
        sessionStorage.setItem(key, value);
    } catch {
        /* no-op: see above */
    }
};

const remove = (key: string): void => {
    try {
        sessionStorage.removeItem(key);
    } catch {
        /* no-op: see above */
    }
};

/** Records a bounce and returns the new consecutive count. */
export const recordBounce = (reason: BounceReason): number => {
    const next = bounceCount() + 1;
    write(REASON_KEY, reason);
    write(COUNT_KEY, String(next));
    return next;
};

export const bounceCount = (): number => {
    const raw = Number(read(COUNT_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
};

/** True once the redirect pair has run often enough to look like a loop. */
export const isBounceLoop = (): boolean => bounceCount() >= MAX_BOUNCES;

/**
 * Reading and clearing are separate on purpose. The read is called from a
 * useState initializer, and StrictMode invokes those twice in development — a
 * function that cleared as it read would hand the second call an empty result
 * and swallow the notice. Clearing belongs in an effect.
 */
export const readBounceReason = (): BounceReason | null => {
    const reason = read(REASON_KEY);
    return reason === "expired" || reason === "failed" ? reason : null;
};

/** Consume the notice so it does not reappear on a later visit. */
export const clearBounceReason = (): void => remove(REASON_KEY);

/** Called on every confirmed sign-in: the chain ended, so the count resets. */
export const clearBounces = (): void => {
    remove(REASON_KEY);
    remove(COUNT_KEY);
};
