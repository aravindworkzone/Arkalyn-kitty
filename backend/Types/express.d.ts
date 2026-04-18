import { IUser } from "../Model/user.model";
import { IGroup } from "../Model/group.model";

declare global {
  namespace Express {
    interface Request {
        user?: IUser;
        group?: IGroup;
    }
  }
}

export {};