import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AppError, type FieldError } from '../helpers/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import PaywallHit from '../models/paywall_hit.model';

// A 402 is the app telling a customer their plan won't let them do something.
// That is the single most useful signal the product produces for deciding what
// to price and what to build, so it gets written down rather than discarded with
// the response.
//
// Fire-and-forget on purpose: this is instrumentation, and a failure to record
// analytics must never turn a clean 402 into a 500 or make the user wait. The
// route is used as the gate identity rather than the message, because messages
// get reworded and would fragment the grouping.
// The route pattern this request matched, e.g. `/api/export/:groupId/:sheet`.
//
// Read from `req.gatePattern`, which asyncHandler stamped while the request was
// still inside its router. It cannot be rebuilt here: by the time an app-level
// error handler runs Express has unwound `baseUrl`, `route` AND `params`, so
// `req.route.path` would give a prefix-less `/:groupId/:sheet` that collides
// across routers, and `originalUrl` would give a raw path full of ids that
// fragments one row per group. Both are useless for aggregation.
//
// The fallback only matters for a 402 thrown outside any asyncHandler-wrapped
// chain, which no current route does.
const gateOf = (req: Request): string =>
    `${req.method} ${req.gatePattern ?? req.originalUrl.split('?')[0] ?? req.path}`;

const recordPaywallHit = (req: Request, message: string): void => {
    void PaywallHit.create({
        groupId: req.group?._id ?? null,
        userId: req.user?._id ?? null,
        // req.group carries the stored tier; the effective one may have lapsed
        // to FREE, but "what did they own when they were blocked" is the useful
        // question for an upgrade conversation.
        tier: req.group?.plan ?? 'FREE',
        gate: gateOf(req),
        message,
    }).catch((err) => {
        logger.warn({ err }, 'Failed to record paywall hit');
    });
};

interface MongoDuplicateKeyError extends Error {
    code: number;
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
}

const isMongoDuplicateKey = (err: unknown): err is MongoDuplicateKeyError =>
    typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    let statusCode = 500;
    let message = 'Internal server error';
    let errors: FieldError[] | undefined;

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        errors = err.errors;
    } else if (err instanceof ZodError) {
        statusCode = 400;
        message = 'Validation failed';
        errors = err.issues.map((issue) => ({
            field: issue.path.join('.') || undefined,
            message: issue.message,
        }));
    } else if (err instanceof mongoose.Error.ValidationError) {
        statusCode = 400;
        message = 'Validation failed';
        errors = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message,
        }));
    } else if (err instanceof mongoose.Error.CastError) {
        statusCode = 400;
        message = `Invalid value for ${err.path}`;
    } else if (isMongoDuplicateKey(err)) {
        statusCode = 409;
        const fields = Object.keys(err.keyPattern ?? {});
        message = 'Duplicate value';
        errors = fields.length
            ? fields.map((field) => ({ field, message: `${field} already exists` }))
            : undefined;
    } else if (err instanceof jwt.TokenExpiredError) {
        statusCode = 401;
        message = 'Token expired';
    } else if (err instanceof jwt.JsonWebTokenError) {
        statusCode = 401;
        message = 'Invalid authentication token';
    } else if (err instanceof Error) {
        message = env.isProduction ? 'Internal server error' : err.message;
    }

    if (statusCode === 402) recordPaywallHit(req, message);

    if (statusCode >= 500) {
        logger.error({ err, path: req.path, method: req.method }, 'Server error');
    } else {
        logger.warn({ err: err instanceof Error ? err.message : err, statusCode, path: req.path, method: req.method }, 'Request rejected');
    }

    const body: {
        success: false;
        message: string;
        errors?: FieldError[];
        stack?: string;
    } = {
        success: false,
        message,
    };

    if (errors && errors.length > 0) body.errors = errors;
    if (!env.isProduction && err instanceof Error) body.stack = err.stack;

    res.status(statusCode).json(body);
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
    next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
};
