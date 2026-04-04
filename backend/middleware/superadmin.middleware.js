const Group = require('../model/group.model');
const mongoose = require("mongoose");
const isSuperAdmin = async (req, res, next) => {
    try {
        let groupId;

        if(req.body.groupId === undefined) {
            groupId = typeof req.body.groupId === "string" ? req.body.groupId.trim() : null;
        } else {
            groupId = typeof req.params.groupId === "string" ? req.params.groupId.trim() : null;
        }

        if(typeof req.body.groupId === "string" && req.body.groupId.trim() === "") {
            return res.status(400).json({ message: "Group ID cannot be empty" });
        }

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

        if (group.superAdmin != req.user._id) {
            return res.status(400).json({ message: "unauthorized" });
        }

        next();
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

module.exports = isSuperAdmin;