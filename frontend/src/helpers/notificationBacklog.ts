/**
 * Whether this sign-in has already been shown its unread backlog.
 *
 * The arrival toast pops notifications that came in over the socket, which by
 * definition only covers the time the tab was open. Anything that landed while
 * the user was signed out reaches them as a silent bump on the bell — so the
 * toaster also pops what is still unread, once, at the start of a session.
 *
 * "Once" is the whole point of this flag: without it a page refresh would
 * re-pop the same backlog, and refreshing is not the same as signing in.
 * sessionStorage is the right scope for that — per tab, cleared when the tab
 * closes — and helpers/endSession.ts clears it too, so signing in as somebody
 * else on the same tab shows their backlog rather than swallowing it.
 *
 * Every access is guarded: sessionStorage throws in some private/embedded
 * contexts, and a toast is never worth breaking a render over. A failed READ
 * reports "already shown", so the failure mode is one missing popup rather than
 * a backlog that re-pops on every single navigation.
 */

const SESSION_KEY = "notifications:backlogShown";

export const isBacklogShown = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return true;
  }
};

export const markBacklogShown = (): void => {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* the backlog will pop again next load — harmless */
  }
};

export const clearBacklogShown = (): void => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing to clear if it could not be written either */
  }
};
