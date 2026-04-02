const Group = require('../model/group.model');
const mongoose = require("mongoose");

exports.createGroup = async (req, res) => {
    try {
        const name = req.body.name.trim();
        const members = Array.isArray(req.body.members) ? req.body.members : [];
        const admin = Array.isArray(req.body.admin) ? req.body.admin : [];

        if (members.length === 0 || admin.length === 0 || !name) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (name.length < 3 || name.length > 100) {
            return res.status(400).json({ message: "Name must be between 3 and 100 characters" });
        }

        const validMemberIds = members.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validMemberIds.length !== members.length) {
            return res.status(400).json({ message: "One or more member IDs are invalid" });
        }

        const group = {
            name,
            members: validMemberIds
        }
        const validAdminIds = admin.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validAdminIds.length !== admin.length) {
            return res.status(400).json({ message: "One or more admin IDs are invalid" });
        }
        group.admin = validAdminIds;

        const groupSave = new Group(group);
        await groupSave.save();

        res.status(201).json({ message: "Group created", groupSave });
    } catch (error) {
        res.status(500).json({ message: 'Error creating group', error });
        console.error('Error creating group:', error);
    }
}

exports.deleteGroup = async (req, res) => {
    try {
        const groupId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }

        const group = await Group.findByIdAndDelete(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        res.status(200).json({ message: "Group deleted", group });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting group', error: error.message });
        console.error('Error deleting group:', error);
    }
}

exports.addGroupMember = async (req, res) => {
    try {
        const groupId = typeof req.body.groupId === "string" ? req.body.groupId.trim() : null;
        const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;

        if (!groupId || !userId) {
            return res.status(400).json({ message: "Group ID and User ID are required" });
        }

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        if (!group.members.includes(userId)) {
            return res.status(400).json({ message: "User is not a member of this group" });
        }

        const groupFind = await Group.findByIdAndUpdate(groupId, { $addToSet : { members: userId}}, { new: true });

        res.status(200).json({ message: "Group members added", groupFind });
    } catch (error) {
        res.status(500).json({ message: 'Error adding group members', error });
        console.error('Error adding group members:', error);
    }
}

exports.removeGroupMember = async (req, res) => {
    try {
        const groupId = typeof req.body.groupId === "string" ? req.body.groupId.trim() : null;
        const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;

        if (!groupId || !userId) {
            return res.status(400).json({ message: "Group ID and User ID are required" });
        }

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        if (!group.members.includes(userId)) {
            return res.status(400).json({ message: "User is not a member of this group" });
        }

        const groupFind = await Group.findByIdAndUpdate(groupId, { $pull: { members: userId }}, { new: true });

        res.status(200).json({ message: "Group members removed", groupFind });
    } catch (error) {
        res.status(500).json({ message: 'Error removing group members', error });
        console.error('Error removing group members:', error);
    }
}

exports.addGroupAdmin = async (req, res) => {
    try {
        const groupId = typeof req.body.groupId === "string" ? req.body.groupId.trim() : null;
        const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;

        if (!groupId || !userId) {
            return res.status(400).json({ message: "Group ID and User ID are required" });
        }

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        if (!group.admin.includes(userId)) {
            return res.status(400).json({ message: "User is not an admin of this group" });
        }

        const groupFind = await Group.findByIdAndUpdate(groupId, { $addToSet : { admin: userId}}, { new: true });

        res.status(200).json({ message: "Group admin added", groupFind });
    } catch (error) {
        res.status(500).json({ message: 'Error adding group admin', error });
        console.error('Error adding group admin:', error);
    }
}

exports.removeGroupAdmin = async (req, res) => {
    try {
        const groupId = typeof req.body.groupId === "string" ? req.body.groupId.trim() : null;
        const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;

        if (!groupId || !userId) {
            return res.status(400).json({ message: "Group ID and User ID are required" });
        }

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        if (!group.admin.includes(userId)) {
            return res.status(400).json({ message: "User is not an admin of this group" });
        }

        const groupFind = await Group.findByIdAndUpdate(groupId, { $pull: { admin: userId }}, { new: true });

        res.status(200).json({ message: "Group admin removed", groupFind });
    } catch (error) {
        res.status(500).json({ message: 'Error removing group admin', error });
        console.error('Error removing group admin:', error);
    }
}

