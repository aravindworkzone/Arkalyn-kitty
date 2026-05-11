import { socket } from "../socket";
import { SOCKET_EVENTS } from "../event";

export const joinGroup = (groupId: string) => {

    socket.emit(
        SOCKET_EVENTS.GROUP_JOIN,
        groupId
    );
};

export const leaveGroup = (groupId: string) => {

    socket.emit(
        SOCKET_EVENTS.GROUP_LEAVE,
        groupId
    );
};