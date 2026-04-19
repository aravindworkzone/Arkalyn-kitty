import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Group from "../Model/group.model";
import Member from "../Model/group_member.model"

const verifyToken = (req, res, next) => {
    const token = req.cookies.AccessToken;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        res.clearCookie('AccessToken');
        return res.status(401).json({ message: "Unauthorized" });
    }
};

const loadGroup = async (req, res, next) => {
    const rawId = req.body.groupId ?? req.params.groupId;
    const groupId = typeof rawId === "string" ? rawId.trim() : null;

    if (!groupId) return res.status(400).json({ message: "Group ID is required" });
    if (!mongoose.Types.ObjectId.isValid(groupId)) return res.status(400).json({ message: "Invalid group ID format" });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    req.group = group;
    next();
};

const authorizeRole = (...roles) => async (req, res, next) => {
    const member = await Member.findOne({
        groupId: req.group._id,
        userId: req.user._id
    });

    console.log(member);
    
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