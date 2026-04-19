import { createGroupService, deleteGroupService, manageMemberService } from "../Service/group.service";
import { Response, Request } from "express";
import mongoose from "mongoose";

export const createGroup = async (req: Request, res: Response) => {
    if(!req.user){
        return res.status(401).json({ message: "Unauthorized" });
    }

    const data = {
        name: req.body.name.trim(),
        members: req.body.members,
        superAdmin: req.user._id.toString()
    }
    try {
        const groupData = await createGroupService(data);
        return res.status(201).json({ message: "Group created", groupData });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message });    
    }
}

export const deleteGroup = async (req: Request, res: Response) => {
    const groupId = req.params.groupId.toString();
    try {
        const group = await deleteGroupService(groupId);

        return res.status(200).json({ message: "Group deleted", group });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message });    
    }
}

export const manageMember = async (req: Request, res: Response) => {
    if(!req.user?._id){
        return res.status(401).json({ message: "Unauthorized" });
    }
    if(!req.group?._id){
        return res.status(400).json({ message: "Group not found" });
    }
    const member = new mongoose.Types.ObjectId(req.body.Member);

    const data = {
        group: req.group._id,
        user: req.user._id,
        action: req.body.action as string,
        Member: member,
        contribution: req.body.contribution as number
    }
    
    try {
        const manageMember = await manageMemberService(data);
        return res.status(200).json({ message: manageMember?.member, user: manageMember?.member });
    } catch (error: any) {
        const statusCode = error.status || 500;
        const message = error.message || 'Internal server error';
        return res.status(statusCode).json({ message: 'Error creating group', error: message });    
    }
};

// exports.manageAdmin = async (req, res) => {
//     const groupData = req.group;
//     const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;
//     const action = req.body.action;

//     if (!userId || !action) {
//         return res.status(400).json({ message: "User ID and action are required" });
//     }

//     if (!["promote", "demote"].includes(action)) {
//         return res.status(400).json({ message: "Action must be 'promote' or 'demote'" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//         return res.status(400).json({ message: "Invalid user ID format" });
//     }

//     const member = groupData.members.find(m => m.user.toString() === userId);

//     if (!member) {
//         return res.status(404).json({ message: "User is not a member of this group" });
//     }

//     if (member.role === "SUPER_ADMIN") {
//         return res.status(400).json({ message: "Cannot change super admin's role" });
//     }

//     if (member.role === "ADMIN" && action === "promote") {
//         return res.status(400).json({ message: "User is already an admin" });
//     }

//     if (member.role !== "ADMIN" && action === "demote") {
//         return res.status(400).json({ message: "User is not an admin" });
//     }

//     const session = await mongoose.startSession();
//     try {
//         session.startTransaction();

//         if (action === "promote") {

//             const updated = await Group.findOneAndUpdate(
//                 { _id: groupData._id, "members.user": userId },
//                 { $set: { "members.$.role": "ADMIN" } },
//                 { returnDocument: "after", session}
//             );

//             await GroupEvent.create([{
//                 groupId: groupData._id,
//                 performedBy: req.user._id,
//                 eventType: "CHANGE_ROLE",
//                 metadata: { userId, note: "Promoted to admin" },
//                 referenceModel: "group"
//             }], { session });

//             await session.commitTransaction();

//             return res.status(200).json({ message: "Member promoted to admin", group: updated });
//         }

//         if (action === "demote") {

//             const updated = await Group.findOneAndUpdate(
//                 { _id: groupData._id, "members.user": userId },
//                 { $set: { "members.$.role": "MEMBER" } },
//                 { returnDocument: "after", session }
//             );

//             await GroupEvent.create([{
//                 groupId: groupData._id,
//                 performedBy: req.user._id,
//                 eventType: "CHANGE_ROLE",
//                 metadata: { userId, note: "Demoted to member" },
//                 referenceModel: "group"
//             }], { session });

//             await session.commitTransaction();

//             return res.status(200).json({ message: "Admin demoted to member", group: updated });
//         }

//         await session.abortTransaction();
//     } catch (error) {
//         await session.abortTransaction();
//         console.error("Error managing admin:", error);
//         return res.status(500).json({ message: "Error managing admin", error: error.message });
//     } finally {
//         await session.endSession();
//     }
// };

// exports.addContribution = async (req, res) => {
//     const groupData = req.group;
//     const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;
//     const contribution = req.body.contribution;

//     if (!userId || contribution === undefined) {
//         return res.status(400).json({ message: "User ID and contribution are required" });
//     }

//     if (typeof contribution !== "number" || contribution <= 0) {
//         return res.status(400).json({ message: "Contribution must be a positive number" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//         return res.status(400).json({ message: "Invalid user ID format" });
//     }

//     const member = groupData.members.find(m => m.user.toString() === userId);
    
//     if (!member) {
//         return res.status(404).json({ message: "User is not a member of this group" });
//     }

//     const session = await mongoose.startSession();
//     try {
//         session.startTransaction();

//         const newContribution = member.contribution + contribution;
//         const newBalance = groupData.balance + contribution;
//         const newTotalContribution = groupData.totalContribution + contribution;

//         const updated = await Group.findOneAndUpdate(
//             { _id: groupData._id, "members.user": userId },
//             { $set: { "members.$.contribution": newContribution, balance: newBalance, totalContribution: newTotalContribution } },
//             { returnDocument: "after", session }
//         );

//         await GroupEvent.create([{
//             groupId: groupData._id,
//             performedBy: req.user._id,
//             eventType: "CREDIT",
//             metadata: { userId, contribution, note: `Added ${contribution}`},
//             referenceModel: "group"
//         }], { session });

//         await session.commitTransaction();

//         return res.status(200).json({ message: "Contribution added", group: updated });
//     } catch (error) {
//         await session.abortTransaction();
//         console.error("Error adding contribution:", error);
//         return res.status(500).json({ message: "Error adding contribution", error: error.message });
//     } finally {
//         await session.endSession();
//     }
// };

// exports.Settlement = async (req, res) => {
//     const groupData = req.group;
//     const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : null;
//     const settlement = req.body.settlement ?? 0;

//     if (!userId || settlement === undefined) {
//         return res.status(400).json({ message: "User ID and settlement amount are required" });
//     }

//     if (typeof settlement !== "number" || settlement <= 0) {
//         return res.status(400).json({ message: "Settlement amount must be a positive number" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//         return res.status(400).json({ message: "Invalid user ID format" });
//     }

//     const member = groupData.members.find(m => m.user.toString() === userId);
    
//     if (!member) {
//         return res.status(404).json({ message: "User is not a member of this group" });
//     }

//     const session = await mongoose.startSession();
//     try {
//         session.startTransaction();

//         const group = await Group.findOneAndUpdate(
//             { _id: groupData._id, "members.user": userId },
//             { 
//                 $set: { "members.$.settlement": true },
//                 $inc: { balance: -settlement }
//             },
//             { returnDocument: "after", session }
//         );

//         await GroupEvent.create([{
//             groupId: groupData._id,
//             performedBy: req.user._id,
//             eventType: "DEBIT",
//             metadata: { userId, contribution: -settlement, note: `${req.user.name} settled ${settlement}`},
//             referenceModel: "group"
//         }], { session });

//         await session.commitTransaction();

//         return res.status(200).json({ message: "Settlement added", group: group });
//     } catch (error) {
//         await session.abortTransaction();
//         console.error("Error adding contribution:", error);
//         return res.status(500).json({ message: "Error adding contribution", error: error.message });
//     } finally {
//         await session.endSession();
//     }
// }

// exports.userGroups = async (req, res) => {
//     try {
//         const userId = req.user._id;

//         const groups = await Group.find({
//             members: { $elemMatch: { user: userId } }
//         });

//         const formattedGroups = await Promise.all(
//             groups.map(async (group) => {

//                 const members = await Promise.all(
//                     group.members.map(async (m) => {
//                         const user = await mongoose
//                             .model("user")
//                             .findById(m.user)
//                             .select("name");

//                         return {
//                             name: user ? user.name : "Unknown User"
//                         };
//                     })
//                 );

//                 const expenseCount = await mongoose
//                     .model("expense")
//                     .countDocuments({ groupId: group._id });

//                 const CreatedOn = new Date(group.createdAt).toLocaleDateString('en-GB', {
//                     day: '2-digit',
//                     month: 'short',
//                     year: 'numeric'
//                 });

//                 return {
//                     _id: group.displayId,
//                     name: group.name,
//                     balance: group.balance,
//                     members: members,
//                     barLength: group.totalContribution > 0 ? Math.round((1 - (group.balance / group.totalContribution)) * 100) : 0,
//                     expenseCount,
//                     CreatedOn
//                 };
//             })
//         );

//         res.status(200).json({
//             message: "User groups",
//             groups: formattedGroups
//         });

//     } catch (error) {
//         console.error("Error fetching user groups:", error);
//         res.status(500).json({
//             message: "Error fetching user groups",
//             error: error.message
//         });
//     }
// };