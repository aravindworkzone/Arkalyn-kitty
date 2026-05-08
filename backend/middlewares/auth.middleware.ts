import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Group from "../models/group.model";
import Member from "../models/group_member.model"
import { Request, Response, NextFunction } from "express";
import { IUser } from "../models/user.model";

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.AccessToken;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        const serect = process.env.JWT_SECRET;
        if(!serect){
            return res.status(401).json({ message: "Unauthorized" });
        }

        req.user = jwt.verify(token, serect) as IUser;
        next();
    } catch (error) {
        res.clearCookie('AccessToken');
        return res.status(401).json({ message: "Unauthorized" });
    }
};

const loadGroup = async (req: Request, res: Response, next: NextFunction) => {
    const rawId = req.body?.groupId ?? req.params?.groupId;
    const groupId = typeof rawId === "string" ? rawId.trim() : null;
    if (!groupId) return res.status(400).json({ message: "Group ID is required" });

    let query;
    if (mongoose.isValidObjectId(groupId)) {
      query = { _id: groupId };
    } else {
      query = { displayId: groupId };
    }

    const group= await Group.findOne(query);
    if (!group) return res.status(404).json({ message: "Group not found" });

    req.group = group;
    next();
};


const authorizeRole = (...roles: string[]) => async (req: Request, res: Response, next: NextFunction) => {
    if(!req.user?._id) return res.status(401).json({ message: "Unauthorized" });
    if(!req.group?._id) return res.status(400).json({ message: "Group not found" });
    const member = await Member.findOne({
        groupId: req.group._id,
        userId: req.user._id
    });
    
    if (!member) {
        return res.status(403).json({ message: "Not a group member" });
    }

    if (!roles.includes(member.role)) {
        return res.status(403).json({ message: "Forbidden" });
    }
    next();
};

export {
    verifyToken,
    loadGroup,
    authorizeRole
};