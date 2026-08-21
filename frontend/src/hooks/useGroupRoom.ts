import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { socket } from "../socket/socket";
import { joinGroup, leaveGroup } from "../socket/emiter/group.emit";
import { setGroupId } from "../redux/slice/group.slice";
import { useRecentGroups } from "./useRecentGroups";

/**
 * Keeps the socket's group room, and the group id the listeners read, pointed
 * at whichever group the session is working in.
 *
 * This used to be split across two screens: page/GroupDetailPage joined the
 * room and set the id, page/GroupPage left and cleared it. That made live
 * updates a property of the route you arrived through rather than of the group
 * you are working in —
 *
 *   · deep-linking to /groups/:id/expenses never joined the room at all, so the
 *     screen most likely to receive expense events was the one that didn't;
 *   · walking from group A's overview to group B's joined B without leaving A,
 *     so the tab kept refetching on A's traffic for the rest of the session;
 *   · a group opened from the sidebar's Recent list — which routes straight to
 *     a sub-page — was never subscribed either.
 *
 * AppLayout owns it now: it wraps every authenticated route and already reads
 * the active group off the pathname, so the room follows navigation anywhere in
 * the app instead of only where someone remembered to wire it up.
 *
 * The socket CONNECTION is a separate thing and is already app-wide —
 * components/ProtectedRouter.tsx opens it as soon as a session resolves, and
 * the server puts every socket in a room keyed by its own userId, which is what
 * carries notifications on screens that have no group at all.
 */
export function useGroupRoom(groupId: string | undefined): void {
    const dispatch = useDispatch();
    const { recent } = useRecentGroups();

    /**
     * The open group, or the last one opened.
     *
     * Stepping off a group's screens — to /notifications, /profile, the group
     * list — deliberately does NOT unsubscribe. Those are side trips, and
     * dropping the room for them means an expense added while the user reads a
     * notification never invalidates the cache, so they come back to numbers
     * that are quietly wrong. Only opening a DIFFERENT group swaps the room,
     * so at most one is ever held.
     *
     * `recent` is the module store hooks/useRecentGroups.ts already keeps for
     * the sidebar, and AppLayout records into it from this same id — reusing it
     * gives the sticky value without a second piece of state, and without the
     * render-phase ref write that computing it here would need.
     */
    const room = groupId ?? recent[0];

    useEffect(() => {
        if (!room) return;
        dispatch(setGroupId(room));
    }, [room, dispatch]);

    useEffect(() => {
        if (!room) return;

        // Emitting while the socket is still connecting is safe: socket.io
        // buffers the event and flushes it on connect.
        joinGroup(room);

        // A dropped connection loses every room it had joined — socket.io
        // restores the connection, never the membership. Without this a
        // reconnect leaves the tab quietly stale until the next navigation.
        const rejoin = () => joinGroup(room);
        socket.on("connect", rejoin);

        return () => {
            socket.off("connect", rejoin);
            leaveGroup(room);
        };
    }, [room]);
}

export default useGroupRoom;
