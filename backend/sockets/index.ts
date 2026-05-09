import type { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';

const parseCookieHeader = (header: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        const key = part.slice(0, eq).trim();
        const val = part.slice(eq + 1).trim();
        if (key) out[key] = decodeURIComponent(val);
    }
    return out;
};

import { env } from '../config/env';
import { COOKIE_NAME } from '../config/constants';
import { logger } from '../utils/logger';
import { groupRoom, SOCKET_EVENTS } from './events';
import { registerGroupHandlers, type AppIO } from './group.socket';
import { registerExpenseHandlers } from './expense.socket';

let io: AppIO | null = null;

export const initSocketServer = (httpServer: HttpServer): AppIO => {
    if (io) return io;

    io = new SocketServer(httpServer, {
        cors: {
            origin: env.FRONTEND_URL,
            credentials: true,
            methods: ['GET', 'POST'],
        },
    }) as AppIO;

    io.use((socket, next) => {
        try {
            const cookieHeader = socket.handshake.headers.cookie;
            if (!cookieHeader) return next(new Error('Missing auth cookie'));
            const cookies = parseCookieHeader(cookieHeader);
            const token = cookies[COOKIE_NAME];
            if (!token) return next(new Error('Missing auth token'));

            const payload = jwt.verify(token, env.JWT_SECRET) as { _id?: string; email?: string };
            if (!payload._id) return next(new Error('Invalid token payload'));

            socket.data.userId = String(payload._id);
            socket.data.email = String(payload.email ?? '');
            next();
        } catch (err) {
            logger.warn({ err }, 'socket auth failed');
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        // logger.debug({ userId: socket.data.userId, sid: socket.id }, 'socket connected');

        // socket.onAny((event, ...args) => {
        //     console.log("incoming", event, args);
        // });

        socket.onAnyOutgoing((event, ...args) => {
            logger.info({ event, args, userId: socket.data.userId }, 'outgoing socket event');
        });

        registerGroupHandlers(io as AppIO, socket);
        registerExpenseHandlers(io as AppIO, socket);

        socket.on('disconnect', (reason) => {
            logger.debug({ userId: socket.data.userId, sid: socket.id, reason }, 'socket disconnected');
        });
    });

    return io;
};

export const getIO = (): AppIO => {
    if (!io) throw new Error('Socket server not initialised — call initSocketServer first');
    return io;
};

export const emitToGroup = (groupId: string, event: string): void => {
    if (!io) {
        logger.warn({ groupId, event }, 'socket emit failed');
        return;
    }
    (io.to(groupRoom(groupId)).emit as (e: string) => void)(event);
};

export { SOCKET_EVENTS };
