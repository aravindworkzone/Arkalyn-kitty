import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { socket } from "../socket";
import { api } from "../../redux/api/base";
import { SOCKET_EVENTS } from "../event";
import type { RootState } from "../../redux/store";

export default function GroupListener() {

    const dispatch = useDispatch();
    const groupId = useSelector((state: RootState) => state.group);

    useEffect(() => {

        if (!groupId) return;

        const refreshGroup = () => {
            dispatch(
                api.util.invalidateTags([
                    { type: "Group", id: groupId }
                ])
            );
        };

        const handleDelete = () => {
            dispatch(
                api.util.invalidateTags([
                    { type: "Group", id: groupId },
                    "Group"
                ])
            );
        };

        const refreshEvents = [
            SOCKET_EVENTS.GROUP_MEMBER_ADDED,
            SOCKET_EVENTS.GROUP_MEMBER_REMOVED,
            SOCKET_EVENTS.GROUP_ROLE_CHANGED,
            SOCKET_EVENTS.GROUP_CONTRIBUTION_ADDED,
            SOCKET_EVENTS.GROUP_SETTLEMENT_COMPLETED,
        ];

        refreshEvents.forEach((e) => socket.on(e, refreshGroup));
        socket.on(SOCKET_EVENTS.GROUP_DELETED, handleDelete);

        return () => {
            refreshEvents.forEach((e) => socket.off(e, refreshGroup));
            socket.off(SOCKET_EVENTS.GROUP_DELETED, handleDelete);
        };

    }, [groupId, dispatch]);

    return null;
}
