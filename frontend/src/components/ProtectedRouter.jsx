import { Navigate, Outlet } from "react-router-dom"
const ProtectedRouter = () => {

    const token = cookieStore.get('AccessToken');
    const isAuthenticated = !!token;

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return <Outlet/>
}

export default ProtectedRouter