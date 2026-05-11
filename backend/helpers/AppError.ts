export interface FieldError {
    field?: string;
    message: string;
}

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly errors?: FieldError[];
    public readonly isOperational: boolean;

    constructor(message: string, statusCode = 500, errors?: FieldError[]) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;
        this.name = 'AppError';
        Error.captureStackTrace?.(this, this.constructor);
    }
}
