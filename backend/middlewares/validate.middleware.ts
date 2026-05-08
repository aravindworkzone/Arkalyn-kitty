import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

export interface ValidationSchemas {
    body?: ZodTypeAny;
    params?: ZodTypeAny;
    query?: ZodTypeAny;
}

export const validate = (schemas: ValidationSchemas): RequestHandler => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            if (schemas.body) req.body = schemas.body.parse(req.body);
            if (schemas.params) schemas.params.parse(req.params);
            if (schemas.query) schemas.query.parse(req.query);
            next();
        } catch (err) {
            next(err);
        }
    };
};
