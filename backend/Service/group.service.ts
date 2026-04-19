import mongoose from "mongoose";
import { AppError } from "../Utils/AppError";
import Group from "../Model/group.model";
import GroupTransaction from "../Model/group_transaction.model";
import GroupEvent from "../Model/group_event.model";
import GroupMember from "../Model/group_member.model";

interface members {
    user: string;
    contribution: number;
}
export const createGroupService = async (data: {name: string, members: members[], superAdmin: string}) => {
    const name = data.name?.trim();
    const members = data.members;
    const superAdmin = data.superAdmin;

    if ((!Array.isArray(members) || members.length === 0) || !superAdmin || !name) {
        throw AppError("All fields are required", 400);
    }

    if (name.length < 3 || name.length > 100) {
        throw AppError("Name must be between 3 and 100 characters", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(superAdmin)) {
        throw AppError("Invalid SuperAdmin ID format", 400);
    }

    const isSuperAdmin = members.some((member) => member.user === superAdmin);
    if (!isSuperAdmin) {
        throw AppError("User is not a member", 400);
    }

    const validMembers = members.filter(obj => mongoose.Types.ObjectId.isValid(obj.user) && obj.contribution >= 0).map(obj => ({
        user: obj.user,
        contribution: obj.contribution
    }));

    const uniqueUserIds = new Set(validMembers.map(m => m.user.toString()));

    if (uniqueUserIds.size !== validMembers.length) {
        throw AppError("Duplicate user IDs are not allowed", 400);
    }

    if (validMembers.length !== members.length) {
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
            userId: member.user,
            contribution: Math.round(member.contribution * 100),
            role: superAdmin.toString() === member.user.toString() ? "SUPER_ADMIN" :  "MEMBER"
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
            metadata: validMembers.map(member => ({ userId: member.user, contributionRS: member.contribution,
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
}

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
}

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

            return {message: "Member added", member: groupMembers};
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

            return {message: "Member Removed"};
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