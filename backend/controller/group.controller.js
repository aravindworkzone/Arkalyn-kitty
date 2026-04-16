const Group = require('../Model/group.model');
const GroupEvent = require('../Model/group_event.model');
const mongoose = require("mongoose");

exports.createGroup = async (req, res) => {
    const name = req.body.name?.trim();
    const members = req.body.members;
    const superAdmin = req.user._id;

    if ((!Array.isArray(members) || members.length === 0) || !superAdmin || !name) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (name.length < 3 || name.length > 100) {
        return res.status(400).json({ message: "Name must be between 3 and 100 characters" });
    }

    if (!mongoose.Types.ObjectId.isValid(superAdmin)) {
        return res.status(400).json({ message: "Invalid SuperAdmin ID format" });
    }

    const validMembers = members.filter(obj => mongoose.Types.ObjectId.isValid(obj.user) && obj.contribution >= 0).map(obj => ({
        user: obj.user,
        contribution: obj.contribution,
        role: superAdmin.toString() === obj.user.toString() ? "SUPER_ADMIN" :  "MEMBER"
    }));

    const uniqueUserIds = new Set(validMembers.map(m => m.user.toString()));

    if (uniqueUserIds.size !== validMembers.length) {
        return res.status(400).json({ message: "Duplicate user IDs are not allowed" });
    }

    if (validMembers.length !== members.length) {
        return res.status(400).json({ message: "member ID are invalid or contribution is negative" });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const TotalContribution = validMembers.reduce((total, member) => total + member.contribution, 0);

        const group = {
            name,
            members: validMembers,
            totalContribution: TotalContribution,
            balance: TotalContribution
        };

        const groupSave = new Group(group);

        const group_log = {
            groupId: groupSave._id,
            performedBy: superAdmin,
            eventType: "CREATE_GROUP",
            referenceModel: "group",
            metadata: { name, totalContribution: TotalContribution, memberCount: validMembers.length, note: "Group created with initial members and contributions" }
        };

        await groupSave.save({session});

        const groupEvent = new GroupEvent(group_log);
        await groupEvent.save({session});

        await session.commitTransaction();

        return res.status(201).json({ message: "Group created", groupSave, groupEvent });
    } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({ message: 'Error creating group', error: error.message });    
    } finally {
        await session.endSession();
    }
}

exports.deleteGroup = async (req, res) => {
    try {
        const groupId = req.params.groupId;

        if (!groupId) {
            return res.status(400).json({ message: "Group ID is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }

        const group = await Group.findByIdAndDelete(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        return res.status(200).json({ message: "Group deleted", group });
    } catch (error) {
        return res.status(500).json({ message: 'Error deleting group', error: error.message });
    }
}

exports.manageMember = async (req, res) => {
    const groupData = req.group;
    const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;
    const action = req.body.action;
    const contribution = req.body.contribution ?? 0;

    if (!userId || !action) {
        return res.status(400).json({ message: "User ID and action are required" });
    }

    if (!["add", "remove"].includes(action)) {
        return res.status(400).json({ message: "Action must be 'add' or 'remove'" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID format" });
    }

    const isMember = groupData.members.filter(m => m.user.toString() === userId);

    console.log(isMember[0].settlement, action);
    if(!isMember[0].settlement && action === "remove") {
        return res.status(400).json({ message: "Cannot remove a member without settlement" });
    }

    if (isMember && action === "add") {
        return res.status(400).json({ message: "User is already a member" });
    }

    if (!isMember && action === "remove") {
        return res.status(400).json({ message: "User is not a member" });
    }

    const isSuperAdmin = groupData.members.some(
        m => m.user.toString() === userId && m.role === "SUPER_ADMIN"
    );
    if (isSuperAdmin && action === "remove") {
        return res.status(400).json({ message: "Cannot remove the super admin" });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        if (action === "add") {

            const updated = await Group.findByIdAndUpdate(
                groupData._id,
                { $addToSet: { members: { user: userId, role: "MEMBER", contribution: contribution } }, balance: groupData.balance + contribution, totalContribution: groupData.totalContribution + contribution },
                { returnDocument: "after", session }
            );

            await GroupEvent.create([{
                groupId: groupData._id,
                performedBy: req.user._id,
                eventType: "MANAGE_MEMBER",
                metadata: { userId, note: `Added as MEMBER with ${contribution} contribution` },
                referenceModel: "group"
            }], { session });

            await session.commitTransaction();

            return res.status(200).json({ message: "Member added", group: updated });
        }

        if (action === "remove") {

            const updated = await Group.findByIdAndUpdate(
                groupData._id,
                { $pull: { members: { user: userId } } },
                { returnDocument: "after", session }
            );

            await GroupEvent.create([{
                groupId: groupData._id,
                performedBy: req.user._id,
                eventType: "MANAGE_MEMBER",
                metadata: { userId, note: "Removed from group" },
                referenceModel: "group"
            }], { session });

            await session.commitTransaction();

            return res.status(200).json({ message: "Member removed", group: updated });
        }

        await session.abortTransaction();
    } catch (error) {
        await session.abortTransaction();
        console.error("Error managing member:", error);
        return res.status(500).json({ message: "Error managing member", error: error.message });
    } finally {
        await session.endSession();
    }
};


exports.manageAdmin = async (req, res) => {
    const groupData = req.group;
    const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;
    const action = req.body.action;

    if (!userId || !action) {
        return res.status(400).json({ message: "User ID and action are required" });
    }

    if (!["promote", "demote"].includes(action)) {
        return res.status(400).json({ message: "Action must be 'promote' or 'demote'" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID format" });
    }

    const member = groupData.members.find(m => m.user.toString() === userId);

    if (!member) {
        return res.status(404).json({ message: "User is not a member of this group" });
    }

    if (member.role === "SUPER_ADMIN") {
        return res.status(400).json({ message: "Cannot change super admin's role" });
    }

    if (member.role === "ADMIN" && action === "promote") {
        return res.status(400).json({ message: "User is already an admin" });
    }

    if (member.role !== "ADMIN" && action === "demote") {
        return res.status(400).json({ message: "User is not an admin" });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        if (action === "promote") {

            const updated = await Group.findOneAndUpdate(
                { _id: groupData._id, "members.user": userId },
                { $set: { "members.$.role": "ADMIN" } },
                { returnDocument: "after", session}
            );

            await GroupEvent.create([{
                groupId: groupData._id,
                performedBy: req.user._id,
                eventType: "CHANGE_ROLE",
                metadata: { userId, note: "Promoted to admin" },
                referenceModel: "group"
            }], { session });

            await session.commitTransaction();

            return res.status(200).json({ message: "Member promoted to admin", group: updated });
        }

        if (action === "demote") {

            const updated = await Group.findOneAndUpdate(
                { _id: groupData._id, "members.user": userId },
                { $set: { "members.$.role": "MEMBER" } },
                { returnDocument: "after", session }
            );

            await GroupEvent.create([{
                groupId: groupData._id,
                performedBy: req.user._id,
                eventType: "CHANGE_ROLE",
                metadata: { userId, note: "Demoted to member" },
                referenceModel: "group"
            }], { session });

            await session.commitTransaction();

            return res.status(200).json({ message: "Admin demoted to member", group: updated });
        }

        await session.abortTransaction();
    } catch (error) {
        await session.abortTransaction();
        console.error("Error managing admin:", error);
        return res.status(500).json({ message: "Error managing admin", error: error.message });
    } finally {
        await session.endSession();
    }
};

exports.addContribution = async (req, res) => {
    const groupData = req.group;
    const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;
    const contribution = req.body.contribution;

    if (!userId || contribution === undefined) {
        return res.status(400).json({ message: "User ID and contribution are required" });
    }

    if (typeof contribution !== "number" || contribution <= 0) {
        return res.status(400).json({ message: "Contribution must be a positive number" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID format" });
    }

    const member = groupData.members.find(m => m.user.toString() === userId);
    
    if (!member) {
        return res.status(404).json({ message: "User is not a member of this group" });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const newContribution = member.contribution + contribution;
        const newBalance = groupData.balance + contribution;
        const newTotalContribution = groupData.totalContribution + contribution;

        const updated = await Group.findOneAndUpdate(
            { _id: groupData._id, "members.user": userId },
            { $set: { "members.$.contribution": newContribution, balance: newBalance, totalContribution: newTotalContribution } },
            { returnDocument: "after", session }
        );

        await GroupEvent.create([{
            groupId: groupData._id,
            performedBy: req.user._id,
            eventType: "CREDIT",
            metadata: { userId, contribution, note: `Added ${contribution}`},
            referenceModel: "group"
        }], { session });

        await session.commitTransaction();

        return res.status(200).json({ message: "Contribution added", group: updated });
    } catch (error) {
        await session.abortTransaction();
        console.error("Error adding contribution:", error);
        return res.status(500).json({ message: "Error adding contribution", error: error.message });
    } finally {
        await session.endSession();
    }
};

exports.Settlement = async (req, res) => {
    const groupData = req.group;
    const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;
    const settlement = req.body.settlement ?? 0;

    if (!userId || settlement === undefined) {
        return res.status(400).json({ message: "User ID and settlement amount are required" });
    }

    if (typeof settlement !== "number" || settlement <= 0) {
        return res.status(400).json({ message: "Settlement amount must be a positive number" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID format" });
    }

    const member = groupData.members.find(m => m.user.toString() === userId);
    
    if (!member) {
        return res.status(404).json({ message: "User is not a member of this group" });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const group = await Group.findOneAndUpdate(
            { _id: groupData._id, "members.user": userId },
            { 
                $set: { "members.$.settlement": true },
                $inc: { balance: -settlement }
            },
            { returnDocument: "after", session }
        );

        await GroupEvent.create([{
            groupId: groupData._id,
            performedBy: req.user._id,
            eventType: "DEBIT",
            metadata: { userId, contribution: -settlement, note: `${req.user.name} settled ${settlement}`},
            referenceModel: "group"
        }], { session });

        await session.commitTransaction();

        return res.status(200).json({ message: "Settlement added", group: group });
    } catch (error) {
        await session.abortTransaction();
        console.error("Error adding contribution:", error);
        return res.status(500).json({ message: "Error adding contribution", error: error.message });
    } finally {
        await session.endSession();
    }
}

exports.userGroups = async (req, res) => {
    try {
        const userId = req.user._id;

        const groups = await Group.find({
            members: { $elemMatch: { user: userId } }
        });

        const formattedGroups = await Promise.all(
            groups.map(async (group) => {

                const members = await Promise.all(
                    group.members.map(async (m) => {
                        const user = await mongoose
                            .model("user")
                            .findById(m.user)
                            .select("name");

                        return {
                            name: user ? user.name : "Unknown User"
                        };
                    })
                );

                const expenseCount = await mongoose
                    .model("expense")
                    .countDocuments({ groupId: group._id });

                const CreatedOn = new Date(group.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });

                return {
                    _id: group.displayId,
                    name: group.name,
                    balance: group.balance,
                    members: members,
                    barLength: group.totalContribution > 0 ? Math.round((1 - (group.balance / group.totalContribution)) * 100) : 0,
                    expenseCount,
                    CreatedOn
                };
            })
        );

        res.status(200).json({
            message: "User groups",
            groups: formattedGroups
        });

    } catch (error) {
        console.error("Error fetching user groups:", error);
        res.status(500).json({
            message: "Error fetching user groups",
            error: error.message
        });
    }
};