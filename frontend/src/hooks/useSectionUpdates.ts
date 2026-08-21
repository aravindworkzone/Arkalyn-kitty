import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useGetSectionUpdatesQuery } from "../redux/api/group";
import { useCurrentUser } from "./useCurrentUser";
import type { GroupSectionKey, GroupSectionUpdates } from "../interface/group";

/**
 * Which navigation destinations have something the user hasn't seen.
 *
 * The server says when each section was last written (GET
 * /group/:id/section-updates); this module remembers when the user last had
 * that section on screen. A stamp newer than the mark is an update, and the
 * nav puts a dot on the row.
 *
 * The marks live in localStorage rather than on the user record because they
 * are per-device by nature — "I read this on my phone" should not clear the dot
 * on a laptop the user hasn't opened in a week — and because a nav affordance
 * is not worth a write to the API on every navigation.
 *
 * A user with no marks at all is a first login, and every non-empty section
 * reads as an update. That is deliberate: on a first visit everything IS new,
 * so every tab is dotted until it has been opened once.
 *
 * Module-level store + useSyncExternalStore, the pattern hooks/useRecentGroups.ts
 * and hooks/useTheme.ts already use — the marks are shared by every consumer,
 * and mutating an external store from an effect keeps this off the
 * set-state-in-effect path the React Compiler lint rejects.
 */

// Marks are keyed by user, so signing out leaves nothing to clear: the next
// account reads its own (empty) set and sees the first-login dots it should.
const STORAGE_KEY = "sidebar:seenSections";

/**
 * Flat map of `userId:groupId:slot` → ISO stamp. Scoped by user so a shared
 * browser doesn't leak marks between accounts; `slot` is a section key for the
 * sidebar, or a rail's own `section:tabId` for a sub-tab.
 */
type Marks = Record<string, string>;

const read = (): Marks => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        // This value is user-writable via devtools, so anything that isn't a
        // string stamp is dropped rather than trusted into a Date().
        const out: Marks = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof v === "string") out[k] = v;
        }
        return out;
    } catch {
        return {};
    }
};

const write = (marks: Marks): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
    } catch {
        /* the dots just won't persist */
    }
};

let current: Marks = typeof window === "undefined" ? {} : read();

const listeners = new Set<() => void>();

const subscribe = (onChange: () => void): (() => void) => {
    listeners.add(onChange);
    return () => {
        listeners.delete(onChange);
    };
};

// Identity is the change signal, so `current` is replaced, never mutated.
const getSnapshot = (): Marks => current;

const EMPTY: Marks = {};
const getServerSnapshot = (): Marks => EMPTY;

const recordSeen = (key: string, stamp: string): void => {
    if (current[key] === stamp) return;
    current = { ...current, [key]: stamp };
    write(current);
    listeners.forEach((l) => l());
};

const isNewer = (stamp: string | null | undefined, mark: string | undefined): boolean => {
    if (!stamp) return false;
    // No mark means never opened — on a first login that is every section.
    if (!mark) return true;
    return new Date(stamp).getTime() > new Date(mark).getTime();
};

/* ── Low-level: one group's marks ─────────────────────────────────────────── */

export interface SeenMarks {
    /** True when `stamp` is newer than the mark held for `slot`. */
    isUnseen: (slot: string, stamp: string | null | undefined) => boolean;
    /** Records `slot` as read up to `stamp`. Safe to call on every render. */
    markSeen: (slot: string, stamp: string | null | undefined) => void;
}

/**
 * The marks for one group, keyed by whatever slot the caller wants.
 *
 * Used directly by rails that split one section across several tabs — the
 * server has no per-tab stamp for those, so they share the section's stamp and
 * keep a mark each. See page/GroupManagementPage.tsx.
 */
export function useSeenMarks(groupId: string | undefined): SeenMarks {
    const { userId } = useCurrentUser();
    const marks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // Stable across writes: recordSeen reads the module store directly, so this
    // closes over the identity only. Callers put it in effect deps, and a
    // markSeen that changed on every mark would re-run them for their own
    // result.
    const markSeen = useCallback(
        (slot: string, stamp: string | null | undefined) => {
            if (!userId || !groupId || !stamp) return;
            recordSeen(`${userId}:${groupId}:${slot}`, stamp);
        },
        [userId, groupId]
    );

    const isUnseen = (slot: string, stamp: string | null | undefined) =>
        !!userId && !!groupId && isNewer(stamp, marks[`${userId}:${groupId}:${slot}`]);

    return { isUnseen, markSeen };
}

/* ── Sidebar: one mark per section ────────────────────────────────────────── */

export interface SectionUpdates {
    /** True when this section has been written since the user last opened it. */
    hasUpdate: (section: GroupSectionKey) => boolean;
    /** Server stamps, undefined until the query resolves. */
    updates: GroupSectionUpdates | undefined;
}

/**
 * Read the dot state for one group.
 *
 * Pass the section the user is currently looking at and it is marked seen —
 * and re-marked whenever its stamp moves while it stays on screen, so an
 * update the user is actively watching never lights its own tab.
 */
export function useSectionUpdates(
    groupId: string | undefined,
    activeSection?: GroupSectionKey
): SectionUpdates {
    const { data: updates } = useGetSectionUpdatesQuery(groupId!, {
        skip: !groupId,
        // The socket's tag invalidations are the live channel, but they only
        // reach a group the session has actually opened (redux/slice/group.slice
        // is set by page/GroupDetailPage). Refetching when the id changes means
        // walking into a group always starts from a true reading.
        refetchOnMountOrArgChange: true,
    });
    const { isUnseen, markSeen } = useSeenMarks(groupId);

    const activeStamp = activeSection ? updates?.[activeSection] ?? null : null;

    useEffect(() => {
        if (!activeSection) return;
        markSeen(activeSection, activeStamp);
    }, [activeSection, activeStamp, markSeen]);

    const hasUpdate = (section: GroupSectionKey): boolean => {
        if (!updates) return false;
        // The section on screen is being read right now; the effect above marks
        // it, but this keeps the dot from flashing in the frame before that.
        if (section === activeSection) return false;
        return isUnseen(section, updates[section]);
    };

    return { hasUpdate, updates };
}

export default useSectionUpdates;
