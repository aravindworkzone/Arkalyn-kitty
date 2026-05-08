import mongoose from "mongoose";
import { AppError } from "../helpers/AppError";
import Group from "../models/group.model";
import GroupTransaction from "../models/group_transaction.model";
import GroupEvent from "../models/group_event.model";
import GroupMember from "../models/group_member.model";

interface members {
    _id: string;
    contribution: number;
}
export const createGroupService = async (data: {name: string, members: members[], superAdmin: string}) => {
    const name = data.name?.trim();
    const members = data.members;
    const superAdmin = data.superAdmin;

    if ((!Array.isArray(members) || members.length === 0) || !superAdmin || !name) {
        throw new AppError("All fields are required", 400);
    }

    if (name.length < 3 || name.length > 100 || !/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(name)) {
        throw new AppError("Name must be between 3 and 100 characters", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(superAdmin)) {
        throw new AppError("Invalid SuperAdmin ID format", 400);
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
        throw new AppError("Duplicate user IDs are not allowed", 400);
    }

    if (validMembers.length !== members.length) {
        console.log(members);
        throw new AppError("member ID are invalid or contribution is negative", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const totalAmount = validMembers.reduce((total, member) => total + member.contribution, 0);

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
            contribution: member.contribution,
            role: superAdmin.toString() === member._id.toString() ? "SUPER_ADMIN" :  "MEMBER"
        }));
        await GroupMember.insertMany(groupMembers, { session });

        const CreateGroupEvent = new GroupEvent({
            groupId: group._id,
            performedBy: superAdmin,
            eventType: "CREATE_GROUP",
            referenceId: group._id,
            referenceModel: "Group",
            metadata: { name, totalContribution: totalAmount, memberCount: validMembers.length, note: `Group created "${name}"` }
        });
        await CreateGroupEvent.save({session});

        const CreateGroupTransaction = new GroupTransaction({
            groupId: group._id,
            amount: totalAmount,
            action: "CREDIT",
            description: "Group created with initial members and contributions",
            referenceId: group._id,
            referenceModel: "Group",
            metadata: validMembers.map(member => ({ userId: member._id, contribution: member.contribution })),
            performedBy: superAdmin
        });
        await CreateGroupTransaction.save({session});

        await session.commitTransaction();

        return group;
    } catch (error: any) {
        await session.abortTransaction();
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        if (error.code === 11000) throw new AppError("Duplicate member detected", 409);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};

export const deleteGroupService = async (groupId: string) => {
    try {

        if (!groupId) {
            throw new AppError("Group ID is required", 400);
        }

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            throw new AppError("Invalid group ID format", 400);
        }

        const group = await Group.findByIdAndDelete(groupId);

        if (!group) {
            throw new AppError("Group not found", 400);
        }

        return group;
    } catch (error: any) {
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
};

export const manageMemberService = async (data: { group: mongoose.Types.ObjectId, user: mongoose.Types.ObjectId, action: string, contribution?: number, Member: mongoose.Types.ObjectId}) => {
    const groupData = data.group;
    const userId = data.user;
    const Member = data.Member;
    const action = data.action;
    const contribution = data.contribution;

    if (!userId || !action) {
        throw new AppError("All fields are required", 400);
    }

    if (!["add", "remove"].includes(action)) {
        throw new AppError("Action must be 'add' or 'remove'", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(Member)) {
        throw new AppError("Invalid user ID format", 400);
    }

    const isMember = await GroupMember.findOne({ groupId: groupData, userId: Member, isDeleted: false });

    if(isMember && !isMember.settlement && action === "remove") {
        throw new AppError("Cannot remove a member without settlement", 400);
    }

    if (isMember && action === "add") {
        throw new AppError("User is already a member", 400);
    }
    
    if (action === "add" && (contribution ?? 0) < 0) {
        throw new AppError("Contribution cannot be negative", 400);
    }

    if (!isMember && action === "remove") {
        throw new AppError("User is not a member", 400);
    }

    if (isMember && isMember.role === "SUPER_ADMIN" && action === "remove") {
        throw new AppError("Cannot remove the super admin", 400);
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
        if (error.code === 11000) throw new AppError("User is already a member", 409);
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
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
        throw new AppError("User ID and action are required", 400);
    }

    if (!["promote", "demote"].includes(action)) {
        throw new AppError("Action must be 'promote' or 'demote'", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new AppError("Invalid user ID format", 400);
    }

    const isMember = await GroupMember.findOne({ groupId: groupData, userId: Member, isDeleted: false });

    if (!isMember) {
        throw new AppError("User is not a member of this group", 400);
    }

    if (isMember.role === "SUPER_ADMIN") {
        throw new AppError("Cannot change super admin's role", 400);
    }

    if (isMember.role === "ADMIN" && action === "promote") {
        throw new AppError("User is already an admin", 400);
    }

    if (isMember.role !== "ADMIN" && action === "demote") {
        throw new AppError("User is not an admin", 400);
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
        if (error.code === 11000) throw new AppError("User is already a member", 409);
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};

export const addContributionService = async (data: {group: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, contribution: number}) => {
    const groupData = data.group;
    const userId = data.userId;
    const contribution = data.contribution;

    if (!userId || contribution === undefined) {
        throw new AppError("User ID and contribution are required", 400);
    }

    if (typeof contribution !== "number" || contribution <= 0) {
        throw new AppError("Contribution must be a positive number", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new AppError("Invalid user ID format", 400);
    }

    const isMember = await GroupMember.findOne({ groupId: groupData, userId: userId, isDeleted: false });
    
    if (!isMember) {
        throw new AppError("User is not a member of this group", 400);
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
        if (error.code === 11000) throw new AppError("User is already a member", 409);
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};

export const SettlementService = async (data : {group: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, settlement: number, member: mongoose.Types.ObjectId, balance: number}) => {
    const groupData = data.group;
    const groupBalance = data.balance;
    const userId = data.userId;
    const Member = data.member;
    const settlement = data.settlement;

    if (!userId || settlement === undefined) {
        throw new AppError("User ID and settlement amount are required", 400);
    }

    if (typeof settlement !== "number") {
        throw new AppError("Settlement amount must be a positive number", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new AppError("Invalid user ID format", 400);
    }

    const isMember = await GroupMember.findOne({ groupId: groupData, userId: Member, isDeleted: false });
    
    if (!isMember) {
        throw new AppError("User is not a member of this group", 400);
    }

    if(settlement > groupBalance) {
        throw new AppError("Settlement amount cannot be greater than group balance", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        await GroupMember.findOneAndUpdate(
            { groupId: groupData, userId: Member },
            { $set: { settlement: true } },
            { returnDocument: "after", session }
        );

        const debited = await Group.findOneAndUpdate(
            { _id: groupData, balance: { $gte: settlement } },
            { $inc: { balance: -settlement } },
            { returnDocument: "after", session }
        );

        if (!debited) {
            throw new AppError("Insufficient balance for settlement", 400);
        }

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
        if (error.code === 11000) throw new AppError("User is already a member", 409);
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};

export const getGroupByIdService = async (groupId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) => {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new AppError("Invalid group ID format", 400);
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const group = (await Group.findOne({ _id: groupId }));
    const currentUser = await GroupMember.findOne({ groupId: groupId, userId: userId, isDeleted: false });

    if (!group) {
        throw new AppError("Group not found", 404);
    }
    if (!currentUser) {
        throw new AppError("Created user not found", 404);
    }
    const barLength = Math.round((1 - group.balance / group.totalContribution) * 100);
    const groupData = {...group.toObject(),role: currentUser.role, barLength};
    return groupData;
};

export const getGroupMemberService = async (groupId: mongoose.Types.ObjectId) => {
    try {
        const members = await GroupMember.find({ groupId, isDeleted: false }).populate("userId");
        return members;
    } catch (error :any) {
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
};

export const getBasicTransactionService = async (groupId: mongoose.Types.ObjectId) => {
    try {
        const transactions = await GroupTransaction.find({ groupId, isDeleted: false });
        const basicTransInfo = transactions.reduce((acc: any,transaction) => {
            if(acc[transaction.action] === undefined) {
                acc[transaction.action] = transaction.amount;
            } else {
                acc[transaction.action] += transaction.amount;
            }
            return acc;
        }, {});

        return basicTransInfo;
    } catch (error :any) {
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
};

export const getTransactionService = async (groupId: mongoose.Types.ObjectId) => {
    try {
        const transactions = await GroupTransaction.find({ groupId, isDeleted: false }).populate("performedBy").populate("referenceId");
        const transaction = transactions.map(t => {
            const createdAt = t.createdAt?.toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            })
            return {...t.toObject(), createdAt}
        });
        return transaction;
    } catch (error :any) {
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
}

export const getEventService = async (groupId: mongoose.Types.ObjectId) => {
    try {
        const transactions = await GroupEvent.find({ groupId, isDeleted: false }).populate("performedBy").populate("referenceId");
        const transaction = transactions.map(t => {
            const createdAt = t.createdAt?.toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            })
            return {...t.toObject(), createdAt}
        });
        return transaction;
    } catch (error :any) {
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
}