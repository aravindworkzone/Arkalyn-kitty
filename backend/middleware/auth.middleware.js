const jwt = require('jsonwebtoken');
const Group = require('../model/group.model');
const mongoose = require("mongoose");

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

const authorizeRole = (...roles) => (req, res, next) => {
    const hasRole = req.group.members.some(
        m => roles.includes(m.role) && m.user.equals(req.user._id)
    );
    if (!hasRole) return res.status(403).json({ message: "Forbidden" });
    next();
};

module.exports = {
    verifyToken,
    loadGroup,
    authorizeRole
};