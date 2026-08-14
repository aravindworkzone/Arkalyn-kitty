import { Outlet, useLocation } from "react-router-dom";

/**
 * Fades routed content in on each navigation.
 *
 * This used to be a single keyed <div> wrapping <Routes> in App.tsx. That was
 * fine while every screen was standalone, but the key remounts its ENTIRE
 * subtree on every path change — and the sidebar now lives in that subtree, so
 * it would unmount, lose its section open/closed state, and re-run its entrance
 * animation on every click.
 *
 * Splitting it into a layout route keeps the effect exactly where it belongs:
 * on the content, never on the shell. AppLayout applies the same key/class
 * around its own Outlet; this component covers the public routes, which have no
 * shell of their own.
 */
export default function RouteFade() {
    const location = useLocation();
    return (
        <div key={location.pathname} className="route-fade">
            <Outlet />
        </div>
    );
}
