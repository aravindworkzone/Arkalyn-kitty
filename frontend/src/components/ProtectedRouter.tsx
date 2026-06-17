import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useEffect } from "react";
import { socket } from "../socket/socket";
import AuthLoader from "./AuthLoader";
import { useCurrentUser } from "../hooks/useCurrentUser";

const ProtectedRouter = () => {
  const location = useLocation();
  const { user, isLoading, isAuthenticated } = useCurrentUser();

  useEffect(() => {
    if (user) {
      socket.connect();
    }
  }, [user]);

  if (isLoading) return <AuthLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet context={{ user }} />;
}

export default ProtectedRouter;