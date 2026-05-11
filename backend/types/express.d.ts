import { IUser } from "../models/user.model";
import { IGroup } from "../models/group.model";

declare global {
  namespace Express {
    interface Request {
        user?: IUser;
        group?: IGroup;
    }
  }
}

export {};