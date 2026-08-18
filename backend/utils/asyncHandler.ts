import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<unknown>;

export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
    return (req, res, next) => {
        // Stamp the matched route pattern before running the handler.
        //
        // `req.baseUrl`, `req.route` and `req.params` are all valid here, inside
        // the router, and all three are unwound by the time an app-level error
        // handler runs — so the error handler cannot reconstruct
        // `/api/export/:groupId/:sheet` on its own. It gets the prefix-less
        // `/:groupId/:sheet` from `req.route.path`, or a raw URL full of ids from
        // `originalUrl`; the first collides across routers, the second fragments
        // per group. Capturing it at the only moment it is knowable fixes both.
        //
        // Set once: several handlers in one chain (validate, loadGroup, the
        // controller) all pass through here, and the first is already correct.
        if (!req.gatePattern && req.route?.path) {
            req.gatePattern = `${req.baseUrl}${req.route.path}`;
        }
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
