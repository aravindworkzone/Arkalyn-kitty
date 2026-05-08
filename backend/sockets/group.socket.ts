import type { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import GroupMember from '../models/group_member.model';
import { logger } from '../utils/logger';
import {
    SOCKET_EVENTS,
    groupRoom,
    type ClientToServerEvents,
    type ServerToClientEvents,
    type InterServerEvents,
    type SocketData,
} from './events';

export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type AppIO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const userBelongsToGroup = async (userId: string, groupId: string): Promise<boolean> => {
    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(userId)) {
        return false;
    }
    const member = await GroupMember.findOne({ groupId, userId, isDeleted: false }).select('_id').lean();
    return Boolean(member);
};

export const registerGroupHandlers = (_io: AppIO, socket: AppSocket): void => {
    socket.on(SOCKET_EVENTS.GROUP_JOIN, async ({ groupId }) => {
        const ok = await userBelongsToGroup(socket.data.userId, groupId);
        if (!ok) {
            socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized for this group' });
            return;
        }
        await socket.join(groupRoom(groupId));
        logger.debug({ userId: socket.data.userId, groupId }, 'socket joined group room');
    });

    socket.on(SOCKET_EVENTS.GROUP_LEAVE, async ({ groupId }) => {
        await socket.leave(groupRoom(groupId));
        logger.debug({ userId: socket.data.userId, groupId }, 'socket left group room');
    });
};
