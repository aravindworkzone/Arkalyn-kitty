import { IUser } from "../models/user.model";
import { IGroup } from "../models/group.model";

declare global {
  namespace Express {
    interface Request {
        user?: IUser;
        group?: IGroup;
        /**
         * The matched route pattern, e.g. `/api/export/:groupId/:sheet`.
         *
         * Stamped by `asyncHandler` while the request is still inside its
         * router, because that is the only point where it can be known: an
         * app-level error handler sees `baseUrl`, `route` and `params` all
         * unwound, leaving it a choice between a prefix-less pattern and a raw
         * URL full of ids. Analytics needs the pattern, so it is captured early
         * and read later.
         */
        gatePattern?: string;
    }
  }
}

export {};