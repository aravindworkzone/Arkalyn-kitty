import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useEffect } from "react";
import { socket } from "../socket/socket";
import { Logo } from "./ui";
import { useCurrentUser } from "../hooks/useCurrentUser";

const ProtectedRouter = () => {
  const location = useLocation();
  const { user, isLoading, isAuthenticated } = useCurrentUser();

  useEffect(() => {
    if (user) {
      socket.connect();
    }
  }, [user]);

  if (isLoading) return (
    <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center gap-6">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 animate-pulse" />
      <div className="space-y-2 w-48">
        <div className="h-2.5 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-2.5 bg-white/[0.04] rounded animate-pulse w-3/4 mx-auto" />
      </div>
    </div>
  );

  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet context={{ user }} />;
}

export default ProtectedRouter;