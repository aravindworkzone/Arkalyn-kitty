import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";

// Gate for /admin/*. Requires an authenticated APP_OWNER; anyone else gets a 403
// screen. Sits inside ProtectedRouter so auth is already guaranteed.
const AdminRoute = () => {
    const location = useLocation();
    const { user, isLoading, isAppOwner, isAuthenticated } = useCurrentUser();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 animate-pulse" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!isAppOwner) {
        return (
            <div className="min-h-screen bg-surface text-fg flex flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-title-md font-bold text-fg">403</p>
                <p className="text-theme-sm text-fg-muted">You don't have access to the owner dashboard.</p>
                <a href="/groups" className="mt-2 text-brand-600 dark:text-brand-400 text-theme-sm hover:text-brand-700 dark:hover:text-brand-300">← Back to the app</a>
            </div>
        );
    }

    return <Outlet context={{ user }} />;
};

export default AdminRoute;
