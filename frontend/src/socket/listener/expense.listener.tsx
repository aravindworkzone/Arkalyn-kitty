import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { socket } from "../socket";
import { api } from "../../redux/api/base";
import { SOCKET_EVENTS } from "../event";
import type { RootState } from "../../redux/store";

export default function ExpenseListener() {

    const dispatch = useDispatch();
    const groupId = useSelector(
        (state: RootState) => state.group
    );

    useEffect(() => {

        if (!groupId) return;

        const handleCreate = () => {

            dispatch(
                api.util.invalidateTags([
                    { type: "Expense", id: groupId },
                    "Group"
                ])
            );
        };

        const handleDelete = () => {

            dispatch(
                api.util.invalidateTags([
                    { type: "Expense", id: groupId },
                    "Group"
                ])
            );
        };

        socket.on(
            SOCKET_EVENTS.EXPENSE_CREATED,
            handleCreate
        );

        socket.on(
            SOCKET_EVENTS.EXPENSE_DELETED,
            handleDelete
        );

        return () => {

            socket.off(
                SOCKET_EVENTS.EXPENSE_CREATED,
                handleCreate
            );
            socket.off(
                SOCKET_EVENTS.EXPENSE_DELETED,
                handleDelete
            );
        };

    }, [groupId, dispatch]);

    return null;
}