import mongoose from "mongoose";
import { AppError } from "../helpers/AppError";
import Group from "../models/group.model";
import GroupTransaction from "../models/group_transaction.model";
import GroupEvent from "../models/group_event.model";
import GroupMember from "../models/group_member.model";
import GroupInvite from "../models/group_invite.model";
import Category from "../models/category.model";
import { createNotification } from "./notification.service";
import { creditGroupBalance, debitGroupBalance, reverseGroupCredit, adjustMemberContribution } from "../helpers/balanceOps";
import { getUserPlan, getGroupOwnerPlan, assertWithinLimit, assertFeature, retentionFloor, countActiveOwnedGroups } from "../helpers/planLimits";

export const createGroupService = async (data: { name: string; invitees: string[]; contribution: number; superAdmin: string }) => {
    const name = data.name?.trim();
    const superAdmin = data.superAdmin;
    const contribution = data.contribution ?? 0;

    if (!superAdmin || !name) {
        throw new AppError("All fields are required", 400);
    }

    if (name.length < 3 || name.length > 100 || !/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(name)) {
        throw new AppError("Name must be between 3 and 100 characters", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(superAdmin)) {
        throw new AppError("Invalid SuperAdmin ID format", 400);
    }

    if (typeof contribution !== "number" || contribution < 0) {
        throw new AppError("Contribution cannot be negative", 400);
    }

    // Subscription gate: cap the number of ACTIVE groups a user can own on their
    // tier. Closed groups are frozen and don't count.
    const ownerPlan = await getUserPlan(superAdmin);
    const ownedGroups = await countActiveOwnedGroups(superAdmin);
    assertWithinLimit(
        ownedGroups,
        ownerPlan.limits.maxGroups,
        `Your ${ownerPlan.config.name} plan allows up to ${ownerPlan.limits.maxGroups} active groups. Upgrade to create more.`
    );

    // Only the creator joins on creation. Everyone else gets a pending invite —
    // their contribution is collected when they accept.
    const invitees = Array.from(new Set((data.invitees ?? []).map(String)))
        .filter((id) => mongoose.Types.ObjectId.isValid(id) && id !== superAdmin.toString());

    const session = await mongoose.startSession();
    let group;
    let createdInvites: { _id: mongoose.Types.ObjectId; invitedUser: mongoose.Types.ObjectId }[] = [];
    try {
        session.startTransaction();

        const CreatGroup = new Group({
            name,
            totalContribution: contribution,
            balance: contribution,
            createdBy: superAdmin,
        });
        group = await CreatGroup.save({ session });

        const creatorMember = new GroupMember({
            groupId: group._id,
            userId: superAdmin,
            contribution,
            role: "SUPER_ADMIN",
        });
        await creatorMember.save({ session });

        const CreateGroupEvent = new GroupEvent({
            groupId: group._id,
            performedBy: superAdmin,
            eventType: "CREATE_GROUP",
            referenceId: group._id,
            referenceModel: "Group",
            metadata: { name, totalContribution: contribution, inviteeCount: invitees.length, note: `Group created "${name}"` },
        });
        await CreateGroupEvent.save({ session });

        const CreateGroupTransaction = new GroupTransaction({
            groupId: group._id,
            amount: contribution,
            action: "CREDIT",
            description: "Group created with creator's initial contribution",
            referenceId: superAdmin,
            referenceModel: "User",
            metadata: [{ userId: superAdmin, contribution }],
            performedBy: superAdmin,
        });
        await CreateGroupTransaction.save({ session });

        if (invitees.length > 0) {
            const inviteDocs = invitees.map((userId) => ({
                groupId: group!._id,
                invitedUser: userId,
                invitedBy: superAdmin,
                status: "PENDING" as const,
            }));
            const inserted = await GroupInvite.insertMany(inviteDocs, { session });
            createdInvites = inserted.map((inv) => ({
                _id: inv._id as mongoose.Types.ObjectId,
                invitedUser: inv.invitedUser,
            }));
        }

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        if (error.code === 11000) throw new AppError("Duplicate member detected", 409);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    // Notifications are non-critical and not part of the group-creation transaction.
    for (const invite of createdInvites) {
        await createNotification({
            recipient: invite.invitedUser,
            actor: superAdmin,
            group: group._id as mongoose.Types.ObjectId,
            type: "GROUP_INVITE",
            metadata: { inviteId: invite._id.toString(), groupName: name, groupDisplayId: group.displayId },
        });
    }

    return group;
};

// Clone an existing group's structure into a brand-new group: copies the
// categories (name + color) and re-invites the source group's active members as
// fresh PENDING invites. Nothing financial is carried over — the new group starts
// with a zero balance and no expenses/transactions/events from the source.
export const cloneGroupService = async (data: { sourceGroupId: string; name: string; superAdmin: string }) => {
    const name = data.name?.trim();
    const superAdmin = data.superAdmin;
    const sourceGroupId = data.sourceGroupId;

    if (!superAdmin || !name || !sourceGroupId) {
        throw new AppError("All fields are required", 400);
    }

    if (name.length < 3 || name.length > 100 || !/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(name)) {
        throw new AppError("Name must be between 3 and 100 characters", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(superAdmin) || !mongoose.Types.ObjectId.isValid(sourceGroupId)) {
        throw new AppError("Invalid ID format", 400);
    }

    const sourceGroup = await Group.findById(sourceGroupId);
    if (!sourceGroup) {
        throw new AppError("Source group not found", 404);
    }

    // Subscription gates. The clone FEATURE is governed by the source group's
    // plan: for a CLOSED group that resolves to its frozen planSnapshot (so a
    // group frozen at Pro/Premium stays cloneable even after the owner
    // downgrades, while one frozen at Free stays blocked); for an open group it
    // resolves the live owner plan. The group-count LIMIT, by contrast, applies
    // to the cloner's own live plan — the clone becomes a new active group on
    // their account.
    const sourcePlan = await getGroupOwnerPlan(sourceGroupId);
    assertFeature(sourcePlan, "cloneGroup", `Cloning a group requires a Pro or Premium plan.`);

    const clonerPlan = await getUserPlan(superAdmin);
    const ownedGroups = await countActiveOwnedGroups(superAdmin);
    assertWithinLimit(
        ownedGroups,
        clonerPlan.limits.maxGroups,
        `Your ${clonerPlan.config.name} plan allows up to ${clonerPlan.limits.maxGroups} active groups. Upgrade to create more.`
    );

    // Categories to copy (skip soft-deleted ones).
    const sourceCategories = await Category.find({ groupId: sourceGroupId, isDeleted: false });

    // Active members of the source become invitees — except the cloner, who joins
    // directly as SUPER_ADMIN of the new group.
    const sourceMembers = await GroupMember.find({ groupId: sourceGroupId, isDeleted: false });
    const invitees = Array.from(new Set(sourceMembers.map((m) => m.userId.toString())))
        .filter((id) => mongoose.Types.ObjectId.isValid(id) && id !== superAdmin.toString());

    const session = await mongoose.startSession();
    let group;
    let createdInvites: { _id: mongoose.Types.ObjectId; invitedUser: mongoose.Types.ObjectId }[] = [];
    try {
        session.startTransaction();

        const CloneGroup = new Group({
            name,
            totalContribution: 0,
            balance: 0,
            createdBy: superAdmin,
        });
        group = await CloneGroup.save({ session });

        const creatorMember = new GroupMember({
            groupId: group._id,
            userId: superAdmin,
            contribution: 0,
            role: "SUPER_ADMIN",
        });
        await creatorMember.save({ session });

        const CreateGroupEvent = new GroupEvent({
            groupId: group._id,
            performedBy: superAdmin,
            eventType: "CREATE_GROUP",
            referenceId: group._id,
            referenceModel: "Group",
            metadata: { name, totalContribution: 0, inviteeCount: invitees.length, note: `Cloned from "${sourceGroup.name}"` },
        });
        await CreateGroupEvent.save({ session });

        const CreateGroupTransaction = new GroupTransaction({
            groupId: group._id,
            amount: 0,
            action: "CREDIT",
            description: `Group cloned from "${sourceGroup.name}"`,
            referenceId: superAdmin,
            referenceModel: "User",
            metadata: [{ userId: superAdmin, contribution: 0 }],
            performedBy: superAdmin,
        });
        await CreateGroupTransaction.save({ session });

        // Copy each category and log a MANAGE_CATEGORY event per category.
        for (const category of sourceCategories) {
            const clonedCategory = new Category({
                groupId: group._id,
                name: category.name,
                color: category.color,
            });
            await clonedCategory.save({ session });

            const categoryEvent = new GroupEvent({
                groupId: group._id,
                performedBy: superAdmin,
                eventType: "MANAGE_CATEGORY",
                referenceId: clonedCategory._id,
                referenceModel: "Category",
                metadata: { userId: superAdmin, note: `Created category: ${category.name}` },
            });
            await categoryEvent.save({ session });
        }

        if (invitees.length > 0) {
            const inviteDocs = invitees.map((userId) => ({
                groupId: group!._id,
                invitedUser: userId,
                invitedBy: superAdmin,
                status: "PENDING" as const,
            }));
            const inserted = await GroupInvite.insertMany(inviteDocs, { session });
            createdInvites = inserted.map((inv) => ({
                _id: inv._id as mongoose.Types.ObjectId,
                invitedUser: inv.invitedUser,
            }));
        }

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        if (error.code === 11000) throw new AppError("Duplicate member detected", 409);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    // Notifications are non-critical and not part of the clone transaction.
    for (const invite of createdInvites) {
        await createNotification({
            recipient: invite.invitedUser,
            actor: superAdmin,
            group: group._id as mongoose.Types.ObjectId,
            type: "GROUP_INVITE",
            metadata: { inviteId: invite._id.toString(), groupName: name, groupDisplayId: group.displayId },
        });
    }

    return group;
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

    // Subscription gate: cap active members per group on the owner's tier.
    if (action === "add") {
        const ownerPlan = await getGroupOwnerPlan(groupData);
        const memberCount = await GroupMember.countDocuments({ groupId: groupData, isDeleted: false });
        assertWithinLimit(
            memberCount,
            ownerPlan.limits.maxMembersPerGroup,
            `This group has reached its ${ownerPlan.config.name}-plan member limit (${ownerPlan.limits.maxMembersPerGroup}). The group owner can upgrade to add more.`
        );
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

            await creditGroupBalance(groupData, contribution ?? 0, { session });

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
                {groupId: groupData, userId: Member, isDeleted: false},
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

export const inviteMemberService = async (data: {
    group: mongoose.Types.ObjectId;
    invitedBy: mongoose.Types.ObjectId;
    invitedUser: mongoose.Types.ObjectId;
}) => {
    const { group: groupId, invitedBy, invitedUser } = data;

    if (!mongoose.Types.ObjectId.isValid(invitedUser)) {
        throw new AppError("Invalid user ID format", 400);
    }
    if (invitedUser.toString() === invitedBy.toString()) {
        throw new AppError("You cannot invite yourself", 400);
    }

    const group = await Group.findById(groupId);
    if (!group) throw new AppError("Group not found", 404);

    const existingMember = await GroupMember.findOne({ groupId, userId: invitedUser, isDeleted: false });
    if (existingMember) throw new AppError("User is already a member of this group", 400);

    // Subscription gate: don't let admins invite past the owner's member limit
    // (the hard cap is re-checked on acceptance).
    const ownerPlan = await getGroupOwnerPlan(groupId);
    const memberCount = await GroupMember.countDocuments({ groupId, isDeleted: false });
    assertWithinLimit(
        memberCount,
        ownerPlan.limits.maxMembersPerGroup,
        `This group has reached its ${ownerPlan.config.name}-plan member limit (${ownerPlan.limits.maxMembersPerGroup}). The group owner can upgrade to invite more.`
    );

    const pendingInvite = await GroupInvite.findOne({ groupId, invitedUser, status: "PENDING" });
    if (pendingInvite) throw new AppError("This user already has a pending invite", 400);

    let invite;
    try {
        invite = await GroupInvite.create({ groupId, invitedUser, invitedBy, status: "PENDING" });
    } catch (error: any) {
        if (error.code === 11000) throw new AppError("This user already has a pending invite", 409);
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }

    // Invitee sets their own contribution when they accept — mirrors group creation.
    await createNotification({
        recipient: invitedUser,
        actor: invitedBy,
        group: groupId,
        type: "GROUP_INVITE",
        metadata: { inviteId: invite._id.toString(), groupName: group.name, groupDisplayId: group.displayId },
    });

    return "Invitation sent";
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
                { groupId: groupData, userId: Member, isDeleted: false },
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
                { groupId: groupData, userId: Member, isDeleted: false },
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

export const addContributionService = async (data: {group: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, contribution: number, description: string}) => {
    const groupData = data.group;
    const userId = data.userId;
    const contribution = data.contribution;
    const description = data.description;

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

        const AddContributionMember = await adjustMemberContribution(groupData, userId, contribution, { session });

        await creditGroupBalance(groupData, contribution, { session });

        const AddContributionLog = new GroupTransaction({
            groupId: groupData,
            amount: contribution,
            action: "CREDIT",
            description: `Added ${contribution} contribution to group ${description ? `with description: ${description}` : ""}`,
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

export const SettlementService = async (data: {
    group: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    settlement: number,
    member: mongoose.Types.ObjectId,
    balance: number
}) => {

    const { group, userId, settlement, member, balance } = data;

    if (!userId || settlement === undefined)
        throw new AppError("User ID and settlement amount are required", 400);

    if (!mongoose.Types.ObjectId.isValid(userId))
        throw new AppError("Invalid user ID format", 400);

    if (!mongoose.Types.ObjectId.isValid(member))
        throw new AppError("Invalid member ID format", 400);

    if (!mongoose.Types.ObjectId.isValid(group))
        throw new AppError("Invalid group ID format", 400);

    if (typeof settlement !== "number" || settlement < 0)
        throw new AppError("Settlement amount must be a positive number", 400);

    if (settlement > balance)
        throw new AppError("Settlement amount cannot be greater than group balance", 400);


    const isMember = await GroupMember.findOne({
        groupId: group,
        userId: member,
        isDeleted: false
    });

    if (!isMember)
        throw new AppError("User is not a member of this group", 400);


    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        await GroupMember.findOneAndUpdate(
            { groupId: group, userId: member, isDeleted: false },
            { $set: { settlement: true, settlementAmount: settlement } },
            { new: true, session }
        );

        if (settlement > 0) {

            const debited = await debitGroupBalance(group, settlement, { session });

            if (!debited)
                throw new AppError("Insufficient balance for settlement", 400);

            await GroupTransaction.create([{
                groupId: group,
                amount: settlement,
                action: "DEBIT",
                description: `Settlement completed: ${settlement}`,
                referenceId: member,
                referenceModel: "User",
                metadata: { member, settlement },
                performedBy: userId
            }], { session });
        }

        await session.commitTransaction();
        return "Settlement Completed";

    } catch (error: any) {
        await session.abortTransaction();
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);

    } finally {
        await session.endSession();
    }
};

export const leaveGroupService = async (data: {
    group: mongoose.Types.ObjectId,
    user: mongoose.Types.ObjectId,
    mode?: "settlement" | "forfeit",
}) => {
    const groupData = data.group;
    const userId = data.user;
    const mode = data.mode ?? "settlement";

    const member = await GroupMember.findOne({ groupId: groupData, userId, isDeleted: false });

    if (!member) {
        throw new AppError("You are not a member of this group", 400);
    }

    if (member.role === "SUPER_ADMIN") {
        throw new AppError("Super admin cannot leave the group", 400);
    }

    // Forfeit path: instant exit, no balance change, no settlement record.
    // The member's contribution stays in the group pool and they show up
    // under "left contributors" with leftMode = "FORFEIT". A pending leave
    // request is silently overridden since the member is leaving anyway.
    if (mode === "forfeit") {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            await GroupMember.findOneAndUpdate(
                { groupId: groupData, userId, isDeleted: false },
                { isDeleted: true, leaveRequestedAt: null, leftMode: "FORFEIT" },
                { session }
            );

            const leaveEvent = new GroupEvent({
                groupId: groupData,
                performedBy: userId,
                eventType: "MEMBER_REMOVED",
                metadata: { userId, note: "Left without settlement — contribution forfeited" },
                referenceId: userId,
                referenceModel: "User",
            });
            await leaveEvent.save({ session });

            await session.commitTransaction();
            return { message: "Left group without settlement", left: true };
        } catch (error: any) {
            await session.abortTransaction();
            if (error.name === "ValidationError") throw new AppError(error.message, 400);
            throw new AppError(error.message || "Internal server error", error.statusCode || 500);
        } finally {
            await session.endSession();
        }
    }

    // Settlement path (default): an already-settled member can leave instantly.
    // An unsettled member files a leave request for admin approval.
    if (!member.settlement) {
        if (member.leaveRequestedAt) {
            throw new AppError("Your leave request is already pending approval", 400);
        }

        member.leaveRequestedAt = new Date();
        await member.save();

        // Notify every admin / super admin of the group so they can act on the request.
        // The requester is excluded in case an admin is the one leaving.
        const admins = await GroupMember.find({
            groupId: groupData,
            role: { $in: ["ADMIN", "SUPER_ADMIN"] },
            userId: { $ne: userId },
            isDeleted: false,
        });
        const group = await Group.findById(groupData);
        await Promise.all(
            admins.map((admin) =>
                createNotification({
                    recipient: admin.userId,
                    actor: userId,
                    group: groupData,
                    type: "LEAVE_REQUESTED",
                    metadata: { memberId: userId, groupName: group?.name },
                })
            )
        );

        return { message: "Leave request sent to the group admins", left: false };
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        await GroupMember.findOneAndUpdate(
            { groupId: groupData, userId, isDeleted: false },
            { isDeleted: true, leaveRequestedAt: null, leftMode: "SETTLED" },
            { returnDocument: "after", session }
        );

        const leaveEvent = new GroupEvent({
            groupId: groupData,
            performedBy: userId,
            eventType: "MEMBER_REMOVED",
            metadata: { userId, note: "Left the group" },
            referenceId: userId,
            referenceModel: "User"
        });
        await leaveEvent.save({ session });

        await session.commitTransaction();

        return { message: "Left group", left: true };
    } catch (error: any) {
        await session.abortTransaction();
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }
};

export const approveLeaveRequestService = async (data: {
    group: mongoose.Types.ObjectId;
    admin: mongoose.Types.ObjectId;
    member: mongoose.Types.ObjectId;
    settlement: number;
    balance: number;
}) => {
    const { group: groupData, admin: adminId, member: memberId, settlement, balance } = data;

    if (typeof settlement !== "number" || settlement < 0) {
        throw new AppError("Settlement amount cannot be negative", 400);
    }

    const member = await GroupMember.findOne({ groupId: groupData, userId: memberId, isDeleted: false });
    if (!member) {
        throw new AppError("User is not a member of this group", 400);
    }
    if (!member.leaveRequestedAt) {
        throw new AppError("This member has no pending leave request", 400);
    }
    if (member.role === "SUPER_ADMIN") {
        throw new AppError("Super admin cannot leave the group", 400);
    }
    // An admin's exit must be authorised by the super admin — a peer admin
    // cannot approve another admin's leave request.
    if (member.role === "ADMIN") {
        const approver = await GroupMember.findOne({ groupId: groupData, userId: adminId, isDeleted: false });
        if (approver?.role !== "SUPER_ADMIN") {
            throw new AppError("Only the super admin can approve an admin's leave request", 403);
        }
    }
    if (settlement > balance) {
        throw new AppError("Settlement amount cannot be greater than group balance", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        await GroupMember.findOneAndUpdate(
            { groupId: groupData, userId: memberId, isDeleted: false },
            { $set: { settlement: true, isDeleted: true, leaveRequestedAt: null, leftMode: "SETTLED" } },
            { session }
        );

        if (settlement > 0) {
            const debited = await debitGroupBalance(groupData, settlement, { session });
            if (!debited) {
                throw new AppError("Insufficient balance for settlement", 400);
            }

            const settlementLog = new GroupTransaction({
                groupId: groupData,
                amount: settlement,
                action: "DEBIT",
                description: `Settled ${settlement} on leave request approval`,
                referenceId: memberId,
                referenceModel: "User",
                metadata: [{ member: memberId, settlement }],
                performedBy: adminId,
            });
            await settlementLog.save({ session });
        }

        const leaveEvent = new GroupEvent({
            groupId: groupData,
            performedBy: adminId,
            eventType: "MEMBER_REMOVED",
            metadata: { userId: memberId, note: "Leave request approved and member settled" },
            referenceId: memberId,
            referenceModel: "User",
        });
        await leaveEvent.save({ session });

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    const group = await Group.findById(groupData);
    await createNotification({
        recipient: memberId,
        actor: adminId,
        group: groupData,
        type: "LEAVE_APPROVED",
        metadata: { groupName: group?.name, settlement },
    });

    return "Leave request approved";
};

export const rejectLeaveRequestService = async (data: {
    group: mongoose.Types.ObjectId;
    admin: mongoose.Types.ObjectId;
    member: mongoose.Types.ObjectId;
}) => {
    const { group: groupData, admin: adminId, member: memberId } = data;

    const member = await GroupMember.findOne({ groupId: groupData, userId: memberId, isDeleted: false });
    if (!member) {
        throw new AppError("User is not a member of this group", 400);
    }
    if (!member.leaveRequestedAt) {
        throw new AppError("This member has no pending leave request", 400);
    }
    // An admin's leave request can only be rejected by the super admin.
    if (member.role === "ADMIN") {
        const approver = await GroupMember.findOne({ groupId: groupData, userId: adminId, isDeleted: false });
        if (approver?.role !== "SUPER_ADMIN") {
            throw new AppError("Only the super admin can reject an admin's leave request", 403);
        }
    }

    member.leaveRequestedAt = null;
    await member.save();

    const group = await Group.findById(groupData);
    await createNotification({
        recipient: memberId,
        actor: adminId,
        group: groupData,
        type: "LEAVE_REJECTED",
        metadata: { groupName: group?.name },
    });

    return "Leave request rejected";
};

export const cancelOwnLeaveRequestService = async (data: {
    group: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
}) => {
    const { group: groupData, user: userId } = data;

    const member = await GroupMember.findOne({ groupId: groupData, userId, isDeleted: false });
    if (!member) {
        throw new AppError("You are not a member of this group", 400);
    }
    if (!member.leaveRequestedAt) {
        throw new AppError("You have no pending leave request", 400);
    }

    member.leaveRequestedAt = null;
    await member.save();

    return "Leave request cancelled";
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
    // Percentage of the pool still remaining (balance ÷ contribution), clamped
    // to 0–100 so a negative or over-refunded balance stays in range.
    const barLength = group.totalContribution > 0
        ? Math.max(0, Math.min(100, Math.round((group.balance / group.totalContribution) * 100)))
        : 0;
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

export const getLeftContributorsService = async (groupId: mongoose.Types.ObjectId) => {
    try {
        const members = await GroupMember.find({
            groupId,
            isDeleted: true,
            contribution: { $gt: 0 },
        }).populate("userId");
        return members;
    } catch (error: any) {
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

export const getTransactionService = async (
    groupId: mongoose.Types.ObjectId,
    page: number,
    limit: number
) => {
    try {
        // Subscription gate: limit how far back the transaction log is visible.
        const ownerPlan = await getGroupOwnerPlan(groupId);
        const floor = retentionFloor(ownerPlan, "transaction");
        const filter = { groupId, isDeleted: false, ...(floor ? { createdAt: { $gte: floor } } : {}) };
        const [docs, total] = await Promise.all([
            GroupTransaction.find(filter)
                .populate("performedBy")
                .populate("referenceId")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            GroupTransaction.countDocuments(filter),
        ]);
        const items = docs.map(t => {
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
        return { items, total };
    } catch (error :any) {
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
}

export const getAllCreditsService = async (
    groupId: mongoose.Types.ObjectId,
    page: number,
    limit: number
) => {
    if (!groupId) throw new AppError("Group ID is required", 400);
    try {
        // Credits are CREDIT-action transactions, so they share the transaction
        // log's retention window.
        const ownerPlan = await getGroupOwnerPlan(groupId);
        const floor = retentionFloor(ownerPlan, "transaction");
        const filter = { groupId, action: "CREDIT", isDeleted: false, ...(floor ? { createdAt: { $gte: floor } } : {}) };
        const [items, total] = await Promise.all([
            GroupTransaction.find(filter)
                .populate("performedBy", "name email")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            GroupTransaction.countDocuments(filter),
        ]);
        return { items, total };
    } catch (error: any) {
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    }
};

export const removeCreditService = async (data: {
    creditId: string;
    groupId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    reason?: string;
}) => {
    if (!mongoose.Types.ObjectId.isValid(data.creditId)) {
        throw new AppError("Invalid credit ID format", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // A "credit" is a CREDIT-action GroupTransaction. Unlike expenses
        // (which live in their own collection), the credits list IS the
        // transaction log — so removal soft-deletes the transaction itself
        // and skips a reversal row, which would otherwise double-count.
        const credit = await GroupTransaction.findOne({
            _id: data.creditId,
            groupId: data.groupId,
            action: "CREDIT",
            isDeleted: false,
        }).session(session);

        if (!credit) throw new AppError("Credit not found", 404);

        const amount = credit.amount;

        // A credit added money to the wallet, so removing it pulls money back
        // out. The $gte guard means we never drive the balance negative — if
        // those funds were already spent on an expense, the credit is locked.
        const updatedGroup = await reverseGroupCredit(data.groupId, amount, { session });

        if (!updatedGroup) {
            throw new AppError(
                "Cannot remove this credit — its funds have already been spent. The group balance is lower than the credit amount.",
                400
            );
        }

        // Roll back the contributor's running contribution total. referenceId
        // is the contributing user for every credit source (group creation,
        // member-add, addContribution). includeLeft so a member who has since
        // left still has their contribution corrected.
        await adjustMemberContribution(data.groupId, credit.referenceId, -amount, { session, includeLeft: true });

        await GroupTransaction.updateOne(
            { _id: credit._id },
            { $set: { isDeleted: true } },
            { session }
        );

        // The credit's soft-delete is the transaction-side record; GroupEvent
        // is the admin-facing log of who removed it and why.
        await GroupEvent.create([{
            groupId: data.groupId,
            performedBy: data.userId,
            eventType: "CREDIT_REMOVED",
            amount,
            referenceId: credit.referenceId,
            referenceModel: "User",
            metadata: {
                creditId: credit._id.toString(),
                note: `Credit of ${amount} removed${data.reason ? `. Reason: ${data.reason}` : ""}`,
            },
        }], { session });

        await session.commitTransaction();
        return credit;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

export const getEventService = async (groupId: mongoose.Types.ObjectId) => {
    try {
        // Subscription gate: limit how far back the event log is visible.
        const ownerPlan = await getGroupOwnerPlan(groupId);
        const floor = retentionFloor(ownerPlan, "event");
        const eventFilter = { groupId, isDeleted: false, ...(floor ? { createdAt: { $gte: floor } } : {}) };
        const transactions = await GroupEvent.find(eventFilter).populate("performedBy").populate("referenceId");
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

export const toggleFavoriteService = async (data: {
    group: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    isFavorite: boolean;
}) => {
    const { group: groupId, user: userId, isFavorite } = data;

    const updated = await GroupMember.findOneAndUpdate(
        { groupId, userId, isDeleted: false },
        { $set: { isFavorite } },
        { new: true }
    );

    if (!updated) throw new AppError("Not a group member", 403);

    return { isFavorite: updated.isFavorite };
};