import { useEffect } from "react";
import { socket } from "../socket";

// Server emits this when the owner suspends/deletes the account. Drop everything
// and bounce to login — the httpOnly cookie is already void server-side.
const FORCE_LOGOUT = "auth:force-logout";

export default function ForceLogoutListener() {
    useEffect(() => {
        const handler = () => {
            socket.disconnect();
            window.location.href = "/login";
        };
        socket.on(FORCE_LOGOUT, handler);
        return () => {
            socket.off(FORCE_LOGOUT, handler);
        };
    }, []);

    return null;
}
