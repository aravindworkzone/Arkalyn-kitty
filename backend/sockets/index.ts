import type { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

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
import { ACCESS_TOKEN_COOKIE } from '../config/constants';
import { verifyAccessToken } from '../services/session.service';
import { logger } from '../utils/logger';
import { getSystemHealthSnapshot } from '../utils/health';
import { groupRoom, SOCKET_EVENTS, ADMIN_ROOM } from './events';
import { registerGroupHandlers, type AppIO } from './group.socket';
import { registerExpenseHandlers } from './expense.socket';

const HEALTH_INTERVAL_MS = 5000;

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
            const token = cookies[ACCESS_TOKEN_COOKIE];
            if (!token) return next(new Error('Missing auth token'));

            const payload = verifyAccessToken(token);
            if (!payload.userId) return next(new Error('Invalid token payload'));

            socket.data.userId = String(payload.userId);
            socket.data.email = '';
            socket.data.role = String(payload.role ?? 'USER');
            next();
        } catch (err) {
            logger.warn({ err }, 'socket auth failed');
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        // logger.debug({ userId: socket.data.userId, sid: socket.id }, 'socket connected');

        // Each socket joins a personal room keyed by userId so the server can
        // emit user-targeted events (e.g. notifications) without tracking sids.
        if (socket.data.userId) {
            void socket.join(socket.data.userId);
        }

        // App owners also join the admins room — the System Health broadcast and
        // any owner-wide events fan out there.
        if (socket.data.role === 'APP_OWNER') {
            void socket.join(ADMIN_ROOM);
        }

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

    // Stream live System Health to the dashboard. Only does work (incl. the DB
    // ping) while at least one owner is watching.
    setInterval(() => {
        const current = io;
        if (!current) return;
        const admins = current.sockets.adapter.rooms.get(ADMIN_ROOM);
        if (!admins || admins.size === 0) return;
        void getSystemHealthSnapshot({ ping: true }).then((snapshot) => {
            (current.to(ADMIN_ROOM).emit as (e: string, p?: unknown) => void)(
                SOCKET_EVENTS.SYSTEM_HEALTH,
                snapshot
            );
        });
    }, HEALTH_INTERVAL_MS).unref();

    return io;
};

export const getIO = (): AppIO => {
    if (!io) throw new Error('Socket server not initialised — call initSocketServer first');
    return io;
};

export const emitToGroup = (groupId: string, event: string, payload?: unknown): void => {
    if (!io) {
        logger.warn({ groupId, event }, 'socket emit failed');
        return;
    }
    (io.to(groupRoom(groupId)).emit as (e: string, p?: unknown) => void)(event, payload);
};

export const emitToUser = (userId: string, event: string, payload?: unknown): void => {
    if (!io) {
        logger.warn({ userId, event }, 'socket emit failed');
        return;
    }
    (io.to(userId).emit as (e: string, p?: unknown) => void)(event, payload);
};

export { SOCKET_EVENTS };
