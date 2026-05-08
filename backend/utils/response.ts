import type { Response } from 'express';

export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data?: T;
    errors?: Array<{ field?: string; message: string }>;
}

export interface PaginatedData<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}

export const sendSuccess = <T>(
    res: Response,
    data: T,
    message = 'OK',
    statusCode = 200
): Response => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    } satisfies ApiResponse<T>);
};

export const sendCreated = <T>(
    res: Response,
    data: T,
    message = 'Created'
): Response => sendSuccess(res, data, message, 201);

export const sendPaginated = <T>(
    res: Response,
    items: T[],
    total: number,
    page: number,
    limit: number,
    message = 'OK'
): Response => {
    return sendSuccess(res, { items, total, page, limit } satisfies PaginatedData<T>, message);
};

export const sendError = (
    res: Response,
    message: string,
    statusCode = 500,
    errors?: Array<{ field?: string; message: string }>
): Response => {
    return res.status(statusCode).json({
        success: false,
        message,
        ...(errors && errors.length > 0 ? { errors } : {}),
    } satisfies ApiResponse<never>);
};
