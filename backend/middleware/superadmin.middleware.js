const Group = require('../model/group.model');
const mongoose = require("mongoose");
const isSuperAdmin = async (req, res, next) => {
    try {
        const rawId = req.body.groupId ?? req.params.groupId;
        const groupId = typeof rawId === "string" ? rawId.trim() : null;

        if (!groupId) {
            return res.status(400).json({ message: "Group ID is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        const superAdmin = group.members.some(
            m => m.role === "SUPER_ADMIN" && m.user.equals(req.user._id)
        );

        if (!superAdmin) {
            return res.status(403).json({ message: "Unauthorized 10000" });
        }

        req.group = group;
        next();
    } catch (error) {
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

module.exports = isSuperAdmin;