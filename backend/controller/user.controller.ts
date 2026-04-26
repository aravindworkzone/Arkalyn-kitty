import {userGroupsService, verifyUserService} from "../Service/user.service";
import { Response, Request } from "express";

export const GetUser = async (req: Request, res: Response) => {
    try {
        res.status(200).json({ message: 'User fetched successfully', user: req.user });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const userGroups = async (req: Request, res: Response) => {
    if(!req.user?._id){
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        const group = await userGroupsService(req.user._id);
        res.status(200).json({
            s_message: "User groups",
            j_groups: group,
            b_status: true
        });

    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message, b_status: false });    
    }
};

export const VerifyUser = async (req: Request, res: Response) => {
    try {
        const verify = await verifyUserService(req.body.email);
        res.status(200).json({ message: 'User verified successfully', user: verify });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};