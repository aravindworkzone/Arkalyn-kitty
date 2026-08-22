import { useCallback, useEffect } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import { cn } from "../helpers/cn";
import { Sidebar } from "./sidebar";
import Header from "./header";
import NotificationToaster from "./notifications/NotificationToaster";
import EnableNotifications from "./BrowserNotification";
import { useSidebar } from "../hooks/useSidebar";
import { useRecentGroups } from "../hooks/useRecentGroups";
import { useGroupRoom } from "../hooks/useGroupRoom";
import { useActiveGroupId } from "../hooks/useActiveGroupId";
import type { CurrentUser } from "../interface/user";

/**
 * The authenticated shell: sidebar + (mobile-only) header + routed content.
 *
 * Introduced so the sidebar mounts once instead of per screen. Previously every
 * page rendered its own <Header />, which returns a fragment and therefore
 * cannot wrap content — with a fixed sidebar each of those 13 pages would have
 * needed its own offset class. A layout route pays for the offset in one place.
 *
 * It MUST re-provide the outlet context: ProtectedRouter supplies `{ user }`
 * and screens read it with useOutletContext, which resolves against the NEAREST
 * Outlet — this one. Dropping it would strand every consumer below.
 */

export interface AppLayoutContext {
    user: CurrentUser | null;
    /**
     * Reveals the sidebar — opens the drawer below md, expands the rail at md+.
     * Screens use this instead of duplicating navigation of their own.
     */
    openSidebar: () => void;
    /**
     * False once the sidebar is already fully visible, so a screen can hide a
     * trigger that would otherwise be a dead button.
     */
    canOpenSidebar: boolean;
}

export default function AppLayout() {
    const { user } = useOutletContext<{ user: CurrentUser | null }>();
    const { collapsed, toggle, isDrawer, mobileOpen, openMobile, closeMobile } = useSidebar();
    const location = useLocation();
    const groupId = useActiveGroupId();

    // Feeds the sidebar's "Recent" section. Recorded here rather than inside the
    // sidebar so it tracks real navigation even while the drawer is shut.
    useRecentGroups(groupId);

    // Live updates for the open group, on every one of its screens rather than
    // only the overview. Here for the same reason as the line above: this is the
    // one component that sees every authenticated navigation.
    useGroupRoom(groupId);

    // A route change means the drawer's job is done. Without this it stays open
    // over the page the user just navigated to.
    useEffect(() => {
        closeMobile();
    }, [location.pathname, closeMobile]);

    // Below md the sidebar is off-canvas, so "reveal it" means open the drawer.
    // At md+ it is already mounted and the only thing hiding its labels is the
    // rail, so it means expand. Fully expanded, there is nothing left to do.
    const openSidebar = useCallback(() => {
        if (isDrawer) openMobile();
        else if (collapsed) toggle();
    }, [isDrawer, collapsed, openMobile, toggle]);

    const canOpenSidebar = isDrawer || collapsed;

    return (
        <div className="min-h-screen bg-surface text-fg">
            <Sidebar
                // A 72px drawer is useless, so the rail only applies to the
                // persistent sidebar at md+.
                collapsed={isDrawer ? false : collapsed}
                onToggle={toggle}
                mobileOpen={mobileOpen}
                onMobileClose={closeMobile}
            />

            {/* Header is mobile-only now — the sidebar owns the chrome at md+. */}
            <Header onOpenSidebar={openMobile} />

            {/* Inside the shell rather than App, so arrival toasts are scoped to
                signed-in screens — the socket only carries a session's own
                notifications, and the landing and auth pages have no bell to
                point at. Outside the keyed route wrapper below: a toast must
                survive the navigation it invites the user to make. */}
            <NotificationToaster />
            {/* Sits inside the authenticated shell so the subscribe call always has
                a session behind it — see the note in BrowserNotification.tsx. */}
            <EnableNotifications />

            <div
                className={cn(
                    "transition-[padding] duration-200",
                    collapsed ? "md:pl-[72px]" : "md:pl-[264px]"
                )}
            >
                {/* Keyed by path so routed content fades in on each navigation.
                    The key is deliberately INSIDE the shell: on the outer
                    wrapper it would remount the sidebar too. */}
                <div key={location.pathname} className="route-fade">
                    <Outlet context={{ user, openSidebar, canOpenSidebar } satisfies AppLayoutContext} />
                </div>
            </div>
        </div>
    );
}
