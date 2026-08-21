import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { socket } from "../socket";
import { endSession } from "../../helpers/endSession";
import type { AppDispatch } from "../../redux/store";

// Server emits this when the owner suspends/deletes the account. Drop everything
// and bounce to login — the httpOnly cookie is already void server-side.
const FORCE_LOGOUT = "auth:force-logout";

export default function ForceLogoutListener() {
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        const handler = () => {
            // Same teardown the two deliberate exits use. The redirect below is a
            // full reload, which clears the store on its own — but not
            // localStorage, and that is where the recent-group list lives.
            endSession(dispatch);
            window.location.href = "/login";
        };
        socket.on(FORCE_LOGOUT, handler);
        return () => {
            socket.off(FORCE_LOGOUT, handler);
        };
    }, [dispatch]);

    return null;
}
