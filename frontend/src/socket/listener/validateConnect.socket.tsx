import { useEffect } from "react";
import { socket } from "../socket";

/**
 * Connection-lifecycle logging.
 *
 * It does NOT open or close the connection, and must not: the socket is opened
 * once per session by components/ProtectedRouter.tsx and closed by the two
 * places a session actually ends — the sign-out handlers in
 * components/sidebar/SidebarFooter.tsx and page/ProfilePage.tsx, and
 * socket/listener/forceLogout.listener.tsx.
 *
 * The cleanup used to call socket.disconnect(). This component is mounted at
 * the root and only unmounts on teardown, so it looked harmless — but under
 * StrictMode's mount/unmount/mount it dropped a live connection on a component
 * that has no business owning one, which is exactly the kind of thing that
 * leaves the app silently unsubscribed with no error anywhere.
 */
export default function ConnectSocket() {

    useEffect(() => {

        const onConnect = () => {
            console.log("socket connected");
        };

        const onDisconnect = () => {
            console.log("socket disconnected");
        };

        const onError = (err: unknown) => {
            console.log("socket error");
            console.log(err);
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onError);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("connect_error", onError);
        };

    }, []);

    return null;
}
