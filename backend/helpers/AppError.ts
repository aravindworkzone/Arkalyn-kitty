export interface FieldError {
    field?: string;
    message: string;
}

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly errors?: FieldError[];
    public readonly isOperational: boolean;
    /**
     * Machine-readable cause, for callers that must branch on *which* failure
     * happened rather than on the status code. The OAuth callback needs this:
     * several unrelated failures share status 401, so a status-keyed lookup told
     * users their Google email was unverified when the real cause was a token
     * exchange that never got that far.
     */
    public readonly code?: string;

    constructor(message: string, statusCode = 500, errors?: FieldError[], code?: string) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;
        this.code = code;
        this.name = 'AppError';
        Error.captureStackTrace?.(this, this.constructor);
    }
}
