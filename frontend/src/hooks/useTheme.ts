import { useSyncExternalStore } from "react";

/**
 * Owns the `.dark` class on <html> — the switch behind Tailwind's `dark:`
 * variant (re-pointed from prefers-color-scheme to a class in index.css).
 *
 * Resolution order, matching the pre-paint bootstrap in index.html:
 *   1. an explicit choice the user made (localStorage)
 *   2. otherwise the OS preference, live — flipping the OS theme with no stored
 *      choice re-themes the app immediately.
 *
 * Module-level store rather than context: the bootstrap script already set the
 * class before React mounted, so there is nothing to provide from the root, and
 * a provider would force every consumer to sit under it.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

const mediaQuery = (): MediaQueryList | null =>
    typeof window === "undefined" ? null : window.matchMedia("(prefers-color-scheme: dark)");

// localStorage throws in some private/embedded contexts. A theme preference is
// never worth breaking a render over, so every access is guarded.
const readStored = (): Theme | null => {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v === "light" || v === "dark" ? v : null;
    } catch {
        return null;
    }
};

const writeStored = (theme: Theme | null): void => {
    try {
        if (theme === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        /* preference just won't persist */
    }
};

const resolve = (): Theme => readStored() ?? (mediaQuery()?.matches ? "dark" : "light");

const apply = (theme: Theme): void => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    // NOTE (phase 6): also sync `documentElement.style.colorScheme` and the
    // theme-color meta here. Held back while the app is still hardcoded dark —
    // see the comment in index.html.
};

const listeners = new Set<() => void>();
let current: Theme = typeof document === "undefined" ? "light" : resolve();

const emit = (): void => listeners.forEach((l) => l());

const setTheme = (theme: Theme): void => {
    writeStored(theme);
    current = theme;
    apply(theme);
    emit();
};

/** Drop the explicit choice and fall back to following the OS. */
const clearTheme = (): void => {
    writeStored(null);
    current = resolve();
    apply(current);
    emit();
};

const subscribe = (onChange: () => void): (() => void) => {
    listeners.add(onChange);

    // Only relevant while there is no stored override; with one, the OS is
    // deliberately being ignored.
    const mq = mediaQuery();
    const onSystemChange = () => {
        if (readStored() !== null) return;
        current = resolve();
        apply(current);
        emit();
    };
    mq?.addEventListener("change", onSystemChange);

    return () => {
        listeners.delete(onChange);
        mq?.removeEventListener("change", onSystemChange);
    };
};

const getSnapshot = (): Theme => current;

export const useTheme = () => {
    const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light" as Theme);

    return {
        theme,
        isDark: theme === "dark",
        setTheme,
        clearTheme,
        toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
        /** True when following the OS rather than an explicit choice. */
        isSystem: readStored() === null,
    };
};

export default useTheme;
