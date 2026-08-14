import { useEffect, useSyncExternalStore } from "react";

/**
 * Most-recently-opened groups, newest first.
 *
 * There is no server-side notion of this. `lastActionAt` exists on the admin
 * payload (interface/admin.ts) but not on /user/usergroups, and adding it would
 * mean a backend change — so recency is tracked locally off actual navigation.
 *
 * Stores `displayId` rather than `_id` because that is what the sidebar routes
 * with, and it keeps the stored value meaningful if it is ever inspected.
 *
 * Module-level store + useSyncExternalStore, exactly like hooks/useTheme.ts.
 * The obvious alternative — useState plus an effect that records the current
 * group — calls setState from inside an effect, which is the cascading-render
 * pattern the React Compiler lint rule rejects. Here `record()` mutates an
 * external store and the subscribers re-read it, so there is no such cascade,
 * and it also means every consumer of this hook sees one shared list.
 *
 * localStorage is guarded the same way useTheme guards it: it throws in some
 * private/embedded contexts, and a nav convenience is never worth breaking a
 * render over.
 */

const STORAGE_KEY = "sidebar:recentGroups";
const MAX = 5;

const read = (): string[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        // Anything that isn't an array of strings is treated as absent rather
        // than trusted — this value is user-writable via devtools.
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
        return [];
    }
};

const write = (ids: string[]): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
        /* recency just won't persist */
    }
};

let current: string[] = typeof window === "undefined" ? [] : read();

const listeners = new Set<() => void>();

const subscribe = (onChange: () => void): (() => void) => {
    listeners.add(onChange);
    return () => {
        listeners.delete(onChange);
    };
};

// Identity is the change signal for useSyncExternalStore, so `current` is
// replaced, never mutated in place.
const getSnapshot = (): string[] => current;

const EMPTY: string[] = [];
const getServerSnapshot = (): string[] => EMPTY;

const record = (displayId: string): void => {
    // Already at the front — no new array, so no re-render.
    if (current[0] === displayId) return;
    current = [displayId, ...current.filter((id) => id !== displayId)].slice(0, MAX);
    write(current);
    listeners.forEach((l) => l());
};

export const clearRecentGroups = (): void => {
    if (current.length === 0) return;
    current = [];
    write(current);
    listeners.forEach((l) => l());
};

/**
 * Pass the open group's displayId to record a visit; omit it to read only.
 */
export function useRecentGroups(currentDisplayId?: string) {
    const recent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // Writing to the external store, not React state — the sanctioned use of an
    // effect, and what keeps this off the set-state-in-effect path.
    useEffect(() => {
        if (currentDisplayId) record(currentDisplayId);
    }, [currentDisplayId]);

    return { recent, clear: clearRecentGroups };
}

export default useRecentGroups;
