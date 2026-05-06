import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useGetUserQuery } from "../redux/api/auth"

const ProtectedRouter = () => {
  const location = useLocation();
  const { data, isLoading, isError } = useGetUserQuery();

  if (isLoading) return (
    <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center gap-6">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 animate-pulse" />
      <div className="space-y-2 w-48">
        <div className="h-2.5 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-2.5 bg-white/[0.04] rounded animate-pulse w-3/4 mx-auto" />
      </div>
    </div>
  );

  if (isError || !data) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet context={{ user: data?.user }} />;
}

export default ProtectedRouter;