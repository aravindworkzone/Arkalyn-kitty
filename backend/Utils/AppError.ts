export const AppError = (message: string, statusCode: number = 500) : never => {
    const error = new Error(message) as Error & { statusCode: number };
    error.statusCode = statusCode;
    throw error;
}