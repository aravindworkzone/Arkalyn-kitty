import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { socket } from "../socket";
import { api } from "../../redux/api/base";
import { SOCKET_EVENTS } from "../event";
import type { RootState } from "../../redux/store";

export default function CategoryListener() {

    const dispatch = useDispatch();
    const groupId = useSelector((state: RootState) => state.group);

    useEffect(() => {

        if (!groupId) return;

        const handleFetch = () => {
            dispatch(api.util.invalidateTags([{ type: "Category", id: groupId }]));
        };

        socket.on(SOCKET_EVENTS.CATEGORY_CREATED, handleFetch);
        socket.on(SOCKET_EVENTS.CATEGORY_UPDATED, handleFetch);
        socket.on(SOCKET_EVENTS.CATEGORY_DELETED, handleFetch);
        // expenseCount on each category goes stale when expenses change.
        socket.on(SOCKET_EVENTS.EXPENSE_CREATED, handleFetch);
        socket.on(SOCKET_EVENTS.EXPENSE_DELETED, handleFetch);

        return () => {
            socket.off(SOCKET_EVENTS.CATEGORY_CREATED, handleFetch);
            socket.off(SOCKET_EVENTS.CATEGORY_UPDATED, handleFetch);
            socket.off(SOCKET_EVENTS.CATEGORY_DELETED, handleFetch);
            socket.off(SOCKET_EVENTS.EXPENSE_CREATED, handleFetch);
            socket.off(SOCKET_EVENTS.EXPENSE_DELETED, handleFetch);
        };
    }, [groupId, dispatch]);

    return null;
}