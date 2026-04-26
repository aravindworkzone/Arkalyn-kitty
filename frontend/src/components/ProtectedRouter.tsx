import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useGetUserQuery } from "../redux/api/auth"

const ProtectedRouter = () => {
  const location = useLocation();
  const { data, isLoading, isError } = useGetUserQuery();

  if (isLoading) return <div>Verifying session...</div>;

  if (isError || !data) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet context={{ user: data?.user }} />;
}

export default ProtectedRouter;