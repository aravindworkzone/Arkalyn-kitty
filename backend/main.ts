import express, { Application, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import { validateEnv, env } from './config/env';
validateEnv();

import connectDB from './db/connection';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { REQUEST_BODY_LIMIT } from './config/constants';

import AuthRouter from './routes/auth.router';
import ExpenseRouter from './routes/expense.router';
import CategoryRouter from './routes/category.router';
import GroupRouter from './routes/group.router';
import UserRouter from './routes/user.router';

const app: Application = express();

app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(cookieParser());
app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true,
    })
);

app.use('/api/auth', AuthRouter);
app.use('/api/expense', ExpenseRouter);
app.use('/api/category', CategoryRouter);
app.use('/api/group', GroupRouter);
app.use('/api/user', UserRouter);

app.get('/', (_req: Request, res: Response) => {
    res.send('Hello World!');
});

app.use(notFoundHandler);
app.use(errorHandler);

connectDB().then(() => {
    app.listen(env.PORT, () => {
        logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');
    });
});
