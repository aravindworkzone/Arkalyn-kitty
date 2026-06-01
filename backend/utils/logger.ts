import pino from 'pino';
import pretty from 'pino-pretty';
import { env } from '../config/env';
import { recentLogStream } from './recentLogs';

// Console stream: pretty in dev, raw JSON to stdout in prod.
const consoleStream = env.isProduction
    ? process.stdout
    : pretty({ colorize: true, translateTime: 'SYS:standard' });

// Multistream: everything to the console; warn+ also tee'd into the in-memory
// ring buffer that powers the dashboard's System Health log panel.
export const logger = pino(
    {
        level: env.isProduction ? 'info' : 'debug',
        redact: {
            paths: ['password', 'token', '*.password', '*.token', 'req.headers.cookie', 'req.headers.authorization'],
            censor: '[REDACTED]',
        },
    },
    pino.multistream([
        { level: env.isProduction ? 'info' : 'debug', stream: consoleStream },
        { level: 'warn', stream: recentLogStream },
    ])
);
