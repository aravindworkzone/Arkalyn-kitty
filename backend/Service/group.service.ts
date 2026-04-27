import mongoose from "mongoose";
import { AppError } from "../Utils/AppError";
import Group from "../Model/group.model";
import GroupTransaction from "../Model/group_transaction.model";
import GroupEvent from "../Model/group_event.model";
import GroupMember from "../Model/group_member.model";

interface members {
    _id: string;
    contribution: number;
}
export const createGroupService = async (data: {name: string, members: members[], superAdmin: string}) => {
    const name = data.name?.trim();
    const members = data.members;
    const superAdmin = data.superAdmin;

    if ((!Array.isArray(members) || members.length === 0) || !superAdmin || !name) {
        throw AppError("All fields are required", 400);
    }

    if (name.length < 3 || name.length > 100 || !/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(name)) {
        throw AppError("Name must be between 3 and 100 characters", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(superAdmin)) {
        throw AppError("Invalid SuperAdmin ID format", 400);
    }

    const isSuperAdmin = members.some((member) => member._id === superAdmin);
    if (!isSuperAdmin) {
        members.push({_id: superAdmin, contribution: 0 });
    }

    const validMembers = members.filter(obj => mongoose.Types.ObjectId.isValid(obj._id) && obj.contribution >= 0).map(obj => ({
        _id: obj._id,
        contribution: obj.contribution
    }));

    const uniqueUserIds = new Set(validMembers.map(m => m._id.toString()));

    if (uniqueUserIds.size !== validMembers.length) {
        throw AppError("Duplicate user IDs are not allowed", 400);
    }

    if (validMembers.length !== members.length) {
        console.log(members);
        throw AppError("member ID are invalid or contribution is negative", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const totalAmount = validMembers.reduce((total, member) => total + Math.round(member.contribution * 100), 0);

        const CreatGroup = new Group({
            name,
            totalContribution: totalAmount,
            balance: totalAmount,
            createdBy: superAdmin
        });
        const group = await CreatGroup.save({session});

        const groupMembers = validMembers.map(member => ({
            groupId: group._id,
            userId: member._id,
            contribution: Math.round(member.contribution * 100),
            role: superAdmin.toString() === member._id.toString() ? "SUPER_ADMIN" :  "MEMBER"
        }));
        await GroupMember.insertMany(groupMembers, { session });

        const CreateGroupEvent = new GroupEvent({
            groupId: group._id,
            performedBy: superAdmin,
            eventType: "CREATE_GROUP",
            referenceId: group._id,
            referenceModel: "Group",
            metadata: { name, totalContribution: totalAmount, memberCount: validMembers.length, note: "Group created with initial members and contributions" }
        });
        await CreateGroupEvent.save({session});

        const CreateGroupTransaction = new GroupTransaction({
            groupId: group._id,
            amount: totalAmount,
            action: "CREDIT",
            description: "Group created with initial members and contributions",
            referenceId: group._id,
            referenceModel: "Group",
            metadata: validMembers.map(member => ({ userId: member._id, contributionRS: member.contribution,
            contribution: Math.round(member.contribution * 100),
            })),
            performedBy: superAdmin
        });
        await CreateGroupTransaction.save({session});

        await session.commitTransaction();

        return group;
    } catch (error: any) {
        await session.abortTransaction();
        if (error.name === "ValidationError") throw AppError(error.message, 400);
        if (error.code === 11000) throw AppError("Duplicate member detected", 409);
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};

export const deleteGroupService = async (groupId: string) => {
    try {

        if (!groupId) {
            throw AppError("Group ID is required", 400);
        }

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            throw AppError("Invalid group ID format", 400);
        }

        const group = await Group.findByIdAndDelete(groupId);

        if (!group) {
            throw AppError("Group not found", 400);
        }

        return group;
    } catch (error: any) {
        if (error.name === "ValidationError") throw AppError(error.message, 400);
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    }
};

export const manageMemberService = async (data: { group: mongoose.Types.ObjectId, user: mongoose.Types.ObjectId, action: string, contribution?: number, Member: mongoose.Types.ObjectId}) => {
    const groupData = data.group;
    const userId = data.user;
    const Member = data.Member;
    const action = data.action;
    const contribution = Math.round((data.contribution ?? 0) * 100);

    if (!userId || !action) {
        throw AppError("All fields are required", 400);
    }

    if (!["add", "remove"].includes(action)) {
        throw AppError("Action must be 'add' or 'remove'", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(Member)) {
        throw AppError("Invalid user ID format", 400);
    }

    const isMember = await GroupMember.findOne({ groupId: groupData, userId: Member, isDeleted: false });

    if(isMember && !isMember.settlement && action === "remove") {
        throw AppError("Cannot remove a member without settlement", 400);
    }

    if (isMember && action === "add") {
        throw AppError("User is already a member", 400);
    }
    
    if (action === "add" && contribution < 0) {
        throw AppError("Contribution cannot be negative", 400);
    }

    if (!isMember && action === "remove") {
        throw AppError("User is not a member", 400);
    }

    if (isMember && isMember.role === "SUPER_ADMIN" && action === "remove") {
        throw AppError("Cannot remove the super admin", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        if (action === "add") {
            const addMember = new GroupMember({
                groupId: groupData,
                userId: Member,
                contribution,
                role: "MEMBER"
            });
            const groupMembers = await addMember.save({ session });

            await Group.findOneAndUpdate(
                { _id: groupData },
                { $inc: { totalContribution: contribution, balance: contribution } },
                { returnDocument: "after", session }
            )

            const groupEventCreate = new GroupEvent({
                groupId: groupData,
                performedBy: userId,
                eventType: "MEMBER_ADDED",
                metadata: { userId, note: `Added as MEMBER with ${contribution} contribution` },
                referenceId: Member,
                referenceModel: "User"
            });
            await groupEventCreate.save({ session });

            const groupTransactionCreate = new GroupTransaction({
                groupId: groupData,
                amount: contribution,
                action: "CREDIT",
                description: `Added as MEMBER with ${contribution} contribution`,
                referenceId: Member,
                referenceModel: "User",
                metadata: [{ Member, contribution }],
                performedBy: userId
            });
            await groupTransactionCreate.save({ session });

            await session.commitTransaction();

            return "Member added";
        }

        if (action === "remove") {

            await GroupMember.findOneAndUpdate(
                {groupId: groupData, userId: Member},
                { isDeleted: true },
                { returnDocument: "after", session }
            );

            const groupEventCreate = new GroupEvent({
                groupId: groupData,
                performedBy: userId,
                eventType: "MEMBER_REMOVED",
                metadata: { userId, note: `Removed from group` },
                referenceId: Member,
                referenceModel: "User"
            });
            await groupEventCreate.save({ session });

            await session.commitTransaction();

            return "Member Removed";
        }
    } catch (error: any) {
        await session.abortTransaction();
        if (error.code === 11000) throw AppError("User is already a member", 409);
        if (error.name === "ValidationError") throw AppError(error.message, 400);
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};

export const manageAdminService = async (data: { group: mongoose.Types.ObjectId, user: mongoose.Types.ObjectId, action: string, member: mongoose.Types.ObjectId }) => {
    const groupData = data.group;
    const userId =  data.user;
    const action = data.action;
    const Member = data.member;

    if (!userId || !action) {
        throw AppError("User ID and action are required", 400);
    }

    if (!["promote", "demote"].includes(action)) {
        throw AppError("Action must be 'promote' or 'demote'", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw AppError("Invalid user ID format", 400);
    }

    const isMember = await GroupMember.findOne({ groupId: groupData, userId: Member, isDeleted: false });

    if (!isMember) {
        throw AppError("User is not a member of this group", 400);
    }

    if (isMember.role === "SUPER_ADMIN") {
        throw AppError("Cannot change super admin's role", 400);
    }

    if (isMember.role === "ADMIN" && action === "promote") {
        throw AppError("User is already an admin", 400);
    }

    if (isMember.role !== "ADMIN" && action === "demote") {
        throw AppError("User is not an admin", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        if (action === "promote") {

            await GroupMember.findOneAndUpdate(
                { groupId: groupData, userId: Member },
                { $set: { role: "ADMIN" } },
                { returnDocument: "after", session}
            );

            const CreateGroupEvent = new GroupEvent({
                groupId: groupData,
                performedBy: userId,
                eventType: "CHANGE_ROLE",
                metadata: { userId, note: "Promoted to admin" },
                referenceId: Member,
                referenceModel: "User"
            })
            await CreateGroupEvent.save({ session });

            await session.commitTransaction();

            return "Member promoted to admin";
        }

        if (action === "demote") {

           await GroupMember.findOneAndUpdate(
                { groupId: groupData, userId: Member },
                { $set: { role: "MEMBER" } },
                { returnDocument: "after", session}
            );

            const CreateGroupEvent = new GroupEvent({
                groupId: groupData,
                performedBy: userId,
                eventType: "CHANGE_ROLE",
                metadata: { userId, note: "Demoted to member" },
                referenceId: Member,
                referenceModel: "User"
            })
            await CreateGroupEvent.save({ session });

            await session.commitTransaction();

            return "Member demoted to member";
        }
    } catch (error : any) {
        await session.abortTransaction();
        if (error.code === 11000) throw AppError("User is already a member", 409);
        if (error.name === "ValidationError") throw AppError(error.message, 400);
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};

export const addContributionService = async (data: {group: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, contribution: number}) => {
    const groupData = data.group;
    const userId = data.userId;
    const contribution = Math.round((data.contribution ?? 0) * 100);

    if (!userId || contribution === undefined) {
        throw AppError("User ID and contribution are required", 400);
    }

    if (typeof contribution !== "number" || contribution <= 0) {
        throw AppError("Contribution must be a positive number", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw AppError("Invalid user ID format", 400);
    }

    const isMember = await GroupMember.findOne({ groupId: groupData, userId: userId, isDeleted: false });
    
    if (!isMember) {
        throw AppError("User is not a member of this group", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const AddContributionMember = await GroupMember.findOneAndUpdate(
            { groupId: groupData, userId: userId },
            { $inc: { contribution: contribution } },
            { returnDocument: "after", session }
        );

        await Group.findOneAndUpdate(
            { _id: groupData },
            { $inc: { balance: contribution, totalContribution: contribution } },
            { returnDocument: "after", session }
        );

        const AddContributionLog = new GroupTransaction({
            groupId: groupData,
            amount: contribution,
            action: "CREDIT",
            description: `Added ${contribution} contribution to group`,
            referenceId: userId,
            referenceModel: "User",
            metadata: [{ userId, contribution }],
            performedBy: userId
        });
        await AddContributionLog.save({ session });

        await session.commitTransaction();

        return AddContributionMember;
    } catch (error : any) {
        await session.abortTransaction();
        if (error.code === 11000) throw AppError("User is already a member", 409);
        if (error.name === "ValidationError") throw AppError(error.message, 400);
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};

export const SettlementService = async (data : {group: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, settlement: number, member: mongoose.Types.ObjectId}) => {
    const groupData = data.group;
    const userId = data.userId;
    const Member = data.member;
    const settlement = Math.round((data.settlement ?? 0) * 100);

    if (!userId || settlement === undefined) {
        throw AppError("User ID and settlement amount are required", 400);
    }

    if (typeof settlement !== "number" || settlement <= 0) {
        throw AppError("Settlement amount must be a positive number", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw AppError("Invalid user ID format", 400);
    }

    const isMember = await GroupMember.findOne({ groupId: groupData, userId: Member, isDeleted: false });
    
    if (!isMember) {
        throw AppError("User is not a member of this group", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        await GroupMember.findOneAndUpdate(
            { groupId: groupData, userId: Member },
            { $set: { settlement: true } },
            { returnDocument: "after", session }
        );
        await Group.findOneAndUpdate(
            { _id: groupData },
            { $inc: { balance: -settlement } },
            { returnDocument: "after", session }
        );

        const settlementLog = new GroupTransaction({
            groupId: groupData,
            amount: settlement,
            action: "DEBIT",
            description: `Settled compeleted ${settlement}`,
            referenceId: Member,
            referenceModel: "User",
            metadata: [{ Member, settlement }],
            performedBy: userId
        });
        await settlementLog.save({ session });

        await session.commitTransaction();

        return "Settlement Completed";
    } catch (error : any) {
        await session.abortTransaction();
        if (error.code === 11000) throw AppError("User is already a member", 409);
        if (error.name === "ValidationError") throw AppError(error.message, 400);
        throw AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};

export const getGroupByIdService = async (groupId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) => {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw AppError("Invalid group ID format", 400);
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const group = await Group.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(groupId)
            }
        },
        {
            $lookup: {
                from: "groupmembers",
                let: { groupId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$groupId", "$$groupId"] },
                                    { $eq: ["$isDeleted", false] }
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "userId",
                            foreignField: "_id",
                            as: "user"
                        }
                    },
                    {
                        $unwind: "$user"
                    },
                    {
                        $project: {
                            _id: 1,
                            userId: 1,
                            role: 1,
                            name: "$user.name",
                            displayId: "$user.displayId",
                            contribution: {$divide:["$contribution",100]}
                        }
                    }
                ],
                as: "MembersDetails"
            }
        },
        {
            $lookup: {
                from: "expenses",
                localField: "_id",
                foreignField: "groupId",
                as: "expense"
            }
        },
        {
            $project: {
                _id: 1,
                displayId: 1,
                name: 1,
                role: {
                    $arrayElemAt: [
                        {
                            $map: {
                                input: {
                                    $filter: {
                                        input: "$MembersDetails",
                                        as: "member",
                                        cond: { $eq: ["$$member.userId", new mongoose.Types.ObjectId(userId)] }
                                    }
                                },
                                as: "m",
                                in: "$$m.role"
                            }
                        },
                        0
                    ]
                },
                barLength:{
                    $multiply: [
                        {
                            $subtract: [
                                {
                                    $divide: [
                                        "$balance",
                                        "$totalContribution"
                                    ]
                                },
                                1
                            ]
                        },
                        100
                    ]
                },
                balance: {$divide: ["$balance",100]},
                totalContribution: {$divide: ["$totalContribution",100]},
                MembersDetails: "$MembersDetails",
                TodayExpenses: {
                    $filter: {
                        input: "$expense",
                        as: "expense",
                        cond: { 
                            $and: [{$eq: ["$$expense.isDeleted", false]}, {$gte: ["$$expense.createdAt", start]}]
                        }
                    }
                }
            }
        }
    ]);
    if (!group) {
        throw AppError("Group not found", 404);
    }
    return group;
};