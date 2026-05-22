import express, { Application, Request, Response } from 'express';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';

import { validateEnv, env } from './config/env';
validateEnv();

import connectDB from './db/connection';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import {
    sanitizeMongoOperators,
    authRateLimiter,
    globalRateLimiter,
} from './middlewares/security.middleware';
import { REQUEST_BODY_LIMIT } from './config/constants';
import { initSocketServer } from './sockets';

import AuthRouter from './routes/auth.router';
import ExpenseRouter from './routes/expense.router';
import CategoryRouter from './routes/category.router';
import GroupRouter from './routes/group.router';
import ReportRouter from './routes/report.router';
import UserRouter from './routes/user.router';
import NotificationRouter from './routes/notification.router';
import InviteRouter from './routes/invite.router';

// Mongoose connection.readyState codes → human-readable labels.
const DB_READY_STATES: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
};

const app: Application = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());

// Health probe for hosting platforms / uptime monitors. Flat response (not the
// API envelope) since monitors expect plain JSON. Placed before the rate
// limiter so probe traffic is never throttled. Returns 503 when the DB is down
// so orchestrators can tell the instance is not ready to serve traffic.
app.get('/health', (_req: Request, res: Response) => {
    const dbState = mongoose.connection.readyState;
    const healthy = dbState === 1;
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        db: DB_READY_STATES[dbState] ?? 'unknown',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

app.use(globalRateLimiter);

app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
app.use(cookieParser());
app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        maxAge: 86400,
    })
);

app.use(sanitizeMongoOperators);

app.use('/api/auth', authRateLimiter, AuthRouter);
app.use('/api/expense', ExpenseRouter);
app.use('/api/category', CategoryRouter);
app.use('/api/group', GroupRouter);
app.use('/api/groupreport', ReportRouter);
app.use('/api/user', UserRouter);
app.use('/api/notifications', NotificationRouter);
app.use('/api/invite', InviteRouter);

app.get('/', (_req: Request, res: Response) => {
    res.send('Hello World!');
});

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = createServer(app);
initSocketServer(httpServer);

connectDB().then(() => {
    httpServer.listen(env.PORT, () => {
        logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started (http + socket.io)');
    });
});
