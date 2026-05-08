import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AppError, type FieldError } from '../helpers/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

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
