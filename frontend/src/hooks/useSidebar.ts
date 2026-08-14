import { useCallback, useEffect, useState } from "react";

/**
 * Owns the sidebar's three display modes and the collapse preference.
 *
 * The sidebar is one component but the viewport gives it three jobs:
 *   >= lg    persistent panel, expanded or collapsed to a rail
 *   md - lg  persistent rail (collapsed by default, still togglable)
 *   <  md    off-canvas drawer, opened from the header hamburger
 *
 * The stored preference is tri-state on purpose. `null` means "auto" — follow
 * the breakpoint — which is what gives md–lg its collapsed-by-default rail
 * without freezing the user out of expanding it. Once they touch the toggle the
 * choice is explicit and is honoured at every size from md up.
 *
 * localStorage is guarded exactly as hooks/useTheme.ts guards it: it throws in
 * some private/embedded contexts, and a sidebar preference is never worth
 * breaking a render over.
 */

const STORAGE_KEY = "sidebar:collapsed";

// Matches Tailwind's own md/lg. Kept as numbers rather than reading the CSS
// custom properties because matchMedia needs a literal query string.
const MD = 768;
const LG = 1024;

type Stored = boolean | null;

const readStored = (): Stored => {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v === "1" ? true : v === "0" ? false : null;
    } catch {
        return null;
    }
};

const writeStored = (v: Stored): void => {
    try {
        if (v === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
        /* preference just won't persist */
    }
};

const width = (): number => (typeof window === "undefined" ? LG : window.innerWidth);

export function useSidebar() {
    const [preference, setPreference] = useState<Stored>(readStored);
    const [vw, setVw] = useState<number>(width);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onResize = () => setVw(window.innerWidth);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const isDrawer = vw < MD;

    // Auto: rail below lg, expanded at lg+. An explicit choice wins at md+.
    const collapsed = preference ?? vw < LG;

    // Growing past md hides the drawer, so its open flag has to stop counting —
    // otherwise the scroll lock outlives the thing that set it. Derived rather
    // than reset in an effect: an effect that calls setState triggers the
    // cascading-render the React Compiler lint rule exists to prevent.
    const drawerOpen = mobileOpen && isDrawer;

    const toggle = useCallback(() => {
        setPreference((prev) => {
            const next = !(prev ?? window.innerWidth < LG);
            writeStored(next);
            return next;
        });
    }, []);

    const openMobile = useCallback(() => setMobileOpen(true), []);
    const closeMobile = useCallback(() => setMobileOpen(false), []);

    // Freeze background scroll while the drawer is open — same approach as the
    // group settings modal in page/GroupDetailPage.tsx.
    useEffect(() => {
        if (!drawerOpen) return;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, [drawerOpen]);

    // Escape closes the drawer, matching the dropdowns in header.tsx.
    useEffect(() => {
        if (!drawerOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [drawerOpen]);

    return { collapsed, toggle, isDrawer, mobileOpen: drawerOpen, openMobile, closeMobile };
}

export default useSidebar;
