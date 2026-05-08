import type { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { RATE_LIMIT } from '../config/constants';

const sanitizeValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (value && typeof value === 'object') return sanitizeObject(value as Record<string, unknown>);
    return value;
};

const sanitizeObject = (obj: Record<string, unknown>): Record<string, unknown> => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
        if (key.startsWith('$') || key.includes('.')) continue;
        cleaned[key] = sanitizeValue(val);
    }
    return cleaned;
};

export const sanitizeMongoOperators: RequestHandler = (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
    }
    next();
};

export const authRateLimiter = rateLimit({
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
    max: RATE_LIMIT.AUTH_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again later.',
    },
});

export const globalRateLimiter = rateLimit({
    windowMs: RATE_LIMIT.GLOBAL_WINDOW_MS,
    max: RATE_LIMIT.GLOBAL_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests. Please slow down.',
    },
});
