import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useGetUserQuery } from "../redux/api/auth";

// Gate for /admin/*. Requires an authenticated APP_OWNER; anyone else gets a 403
// screen. Sits inside ProtectedRouter so auth is already guaranteed.
const AdminRoute = () => {
    const location = useLocation();
    const { data, isLoading } = useGetUserQuery();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 animate-pulse" />
            </div>
        );
    }

    if (!data?.success) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (data?.data?.user?.role !== "APP_OWNER") {
        return (
            <div className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-5xl font-bold text-white/80">403</p>
                <p className="text-sm text-white/40">You don't have access to the owner dashboard.</p>
                <a href="/groups" className="mt-2 text-violet-400 text-sm hover:text-violet-300">← Back to the app</a>
            </div>
        );
    }

    return <Outlet context={{ user: data?.data?.user }} />;
};

export default AdminRoute;
