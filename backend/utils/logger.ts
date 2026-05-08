import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
    level: env.isProduction ? 'info' : 'debug',
    transport: env.isProduction
        ? undefined
        : {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:standard' },
          },
    redact: {
        paths: ['password', 'token', '*.password', '*.token', 'req.headers.cookie', 'req.headers.authorization'],
        censor: '[REDACTED]',
    },
});
