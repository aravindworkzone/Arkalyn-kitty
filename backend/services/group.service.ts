import mongoose from "mongoose";
import { AppError } from "../helpers/AppError";
import Group from "../models/group.model";
import GroupTransaction from "../models/group_transaction.model";
import GroupEvent from "../models/group_event.model";
import GroupMember from "../models/group_member.model";
import GroupInvite from "../models/group_invite.model";
import Category from "../models/category.model";
import { isSelectableGroupPurpose, type GroupPurpose } from "../models/group.model";
import { toGroupTypeView } from "../helpers/groupTypes";
import { assertMemberFreeOfChit } from "../helpers/chitGuards";
import { PURPOSE_DEFAULT_CATEGORIES } from "../config/purposeCategories";
import { createNotification } from "./notification.service";
import { getOrCreateOtherCreditCategory } from "./category.service";
import { creditGroupBalance, debitGroupBalance, reverseGroupCredit, adjustMemberContribution } from "../helpers/balanceOps";
import { getGroupPlan, getEffectivePlan, toPlanView, assertWithinLimit, assertFeature, retentionFloor, countActiveOwnedGroups, defaultJoinRole } from "../helpers/planLimits";
import { MAX_ACTIVE_OWNED_GROUPS } from "../config/constants";

export const createGroupService = async (data: { name: string; invitees: string[]; contribution: number; superAdmin: string; purpose?: string }) => {
    const name = data.name?.trim();
    const superAdmin = data.superAdmin;
    const contribution = data.contribution ?? 0;
    // Purpose decides the group's TYPE, and therefore which features it has —
    // and it is immutable once set. So an unrecognised value is rejected rather
    // than coerced to a default: silently seating a group on the wrong feature
    // set would leave no way to correct it afterwards. Only the three selectable
    // types are accepted here; the legacy values remain valid in the schema for
    // groups that already carry them, but no new group may be created on one.
    if (!isSelectableGroupPurpose(data.purpose)) {
        throw new AppError("Choose a group type: Family, Chit or Reserve", 400);
    }
    const purpose: GroupPurpose = data.purpose;

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

    // Anti-abuse cap, not a subscription gate: a new group is born FREE and
    // carries its own plan, so the number of groups an account owns is no longer
    // something a tier can raise. Closed groups are frozen and don't count.
    const ownedGroups = await countActiveOwnedGroups(superAdmin);
    assertWithinLimit(
        ownedGroups,
        MAX_ACTIVE_OWNED_GROUPS,
        `You can own up to ${MAX_ACTIVE_OWNED_GROUPS} active groups. Close one before creating another.`
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
            purpose,
            totalContribution: contribution,
            balance: contribution,
            createdBy: superAdmin,
        });
        group = await CreatGroup.save({ session });

        // Seed the purpose's default categories (free — bypasses the per-group
        // category plan limit, same as cloning). Done in-transaction so a
        // failure rolls back the whole group creation.
        const defaults = PURPOSE_DEFAULT_CATEGORIES[purpose] ?? [];
        if (defaults.length > 0) {
            await Category.insertMany(
                defaults.map((c) => ({
                    groupId: group!._id,
                    name: c.name,
                    color: c.color,
                    isSpecial: c.isSpecial ?? false,
                    // RESERVE seeds CREDIT buckets — it cannot record expenses,
                    // so expense categories would be unusable in it.
                    type: c.type ?? "EXPENSE",
                })),
                { session }
            );
        }

        // Every group starts with a single "Other" credit category — the
        // creator's initial contribution (and any later credit) lands here
        // until the group adds more credit categories.
        const otherCreditCategory = await getOrCreateOtherCreditCategory(group._id, session);

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
            category: otherCreditCategory._id,
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

    // Subscription gate: cloning is a paid feature of the SOURCE group — it is
    // that group's structure being copied, and that group's plan paid for it. A
    // CLOSED source resolves to its frozen planSnapshot (so a group frozen at
    // Pro/Premium stays cloneable even after its plan lapses, while one frozen at
    // Free stays blocked); an open source resolves its live plan.
    //
    // The CLONE, however, is born FREE like any new group — a paid plan belongs
    // to the group that bought it and is never copied. The only count check left
    // is the flat anti-abuse cap on the cloner's account.
    const sourcePlan = await getGroupPlan(sourceGroupId);
    assertFeature(sourcePlan, "cloneGroup", `Cloning a group requires a Pro or Premium plan.`);

    const ownedGroups = await countActiveOwnedGroups(superAdmin);
    assertWithinLimit(
        ownedGroups,
        MAX_ACTIVE_OWNED_GROUPS,
        `You can own up to ${MAX_ACTIVE_OWNED_GROUPS} active groups. Close one before cloning another.`
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

        // Purpose IS carried over, unlike anything financial. It decides the
        // group's type and therefore its features, so a clone that dropped it
        // would silently become a Family group — and since type is immutable,
        // cloning a Reserve or Chit group would be a one-way trip to the wrong
        // feature set. Legacy purposes clone as-is; they resolve to FAMILY, which
        // is what the source behaves as too.
        const CloneGroup = new Group({
            name,
            purpose: sourceGroup.purpose,
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

        // Copy each category (preserving its EXPENSE/CREDIT type) and log a
        // MANAGE_CATEGORY event per category.
        for (const category of sourceCategories) {
            const clonedCategory = new Category({
                groupId: group._id,
                name: category.name,
                color: category.color,
                type: category.type ?? "EXPENSE",
                isSpecial: category.isSpecial ?? false,
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

        // Ensure the clone has an "Other" credit category (finds a copied one
        // or creates it) and tag the opening 0-credit row to it.
        const otherCreditCategory = await getOrCreateOtherCreditCategory(group._id, session);

        const CreateGroupTransaction = new GroupTransaction({
            groupId: group._id,
            amount: 0,
            action: "CREDIT",
            description: `Group cloned from "${sourceGroup.name}"`,
            referenceId: superAdmin,
            referenceModel: "User",
            category: otherCreditCategory._id,
            metadata: [{ userId: superAdmin, contribution: 0 }],
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

    // A participant in a running chit cannot be removed: the scheme promises one
    // cycle per member, so losing one leaves a cycle that can never collect a
    // full pot.
    if (isMember && action === "remove") {
        await assertMemberFreeOfChit(groupData, Member);
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

    // Subscription gate: cap active members per group on the GROUP's tier. The
    // same plan read decides what role the joiner takes, so it is resolved here
    // rather than fetched a second time inside the transaction.
    let joinRole: "ADMIN" | "MEMBER" = "MEMBER";
    if (action === "add") {
        const groupPlan = await getGroupPlan(groupData);
        const memberCount = await GroupMember.countDocuments({ groupId: groupData, isDeleted: false });
        assertWithinLimit(
            memberCount,
            groupPlan.limits.maxMembersPerGroup,
            `This group has reached its ${groupPlan.config.name}-plan member limit (${groupPlan.limits.maxMembersPerGroup}). Upgrade this group's plan to add more.`
        );
        joinRole = defaultJoinRole(groupPlan);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        if (action === "add") {
            const addMember = new GroupMember({
                groupId: groupData,
                userId: Member,
                contribution,
                role: joinRole
            });
            const groupMembers = await addMember.save({ session });

            await creditGroupBalance(groupData, contribution ?? 0, { session });

            const otherCreditCategory = await getOrCreateOtherCreditCategory(groupData, session);

            const groupEventCreate = new GroupEvent({
                groupId: groupData,
                performedBy: userId,
                eventType: "MEMBER_ADDED",
                metadata: { userId, note: `Added as ${joinRole} with ${contribution} contribution` },
                referenceId: Member,
                referenceModel: "User"
            });
            await groupEventCreate.save({ session });

            const groupTransactionCreate = new GroupTransaction({
                groupId: groupData,
                amount: contribution,
                action: "CREDIT",
                description: `Added as ${joinRole} with ${contribution} contribution`,
                referenceId: Member,
                referenceModel: "User",
                category: otherCreditCategory._id,
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

    // Subscription gate: don't let admins invite past the group's member limit
    // (the hard cap is re-checked on acceptance).
    const groupPlan = await getGroupPlan(groupId);
    const memberCount = await GroupMember.countDocuments({ groupId, isDeleted: false });
    assertWithinLimit(
        memberCount,
        groupPlan.limits.maxMembersPerGroup,
        `This group has reached its ${groupPlan.config.name}-plan member limit (${groupPlan.limits.maxMembersPerGroup}). Upgrade this group's plan to invite more.`
    );

    // Covers both an unanswered invite and one the user accepted that is still
    // waiting on an admin — only the former is guarded by the unique index.
    const pendingInvite = await GroupInvite.findOne({
        groupId,
        invitedUser,
        status: { $in: ["PENDING", "PENDING_APPROVAL"] },
    });
    if (pendingInvite) {
        throw new AppError(
            pendingInvite.status === "PENDING_APPROVAL"
                ? "This user is already waiting for approval to join"
                : "This user already has a pending invite",
            400
        );
    }

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

    // Subscription gate: demoting is the one path that MINTS a MEMBER, and a
    // flat group has no such role to demote into. Promotion stays free — a group
    // must always be able to hand out admin rights, not least so a lapsed group
    // can still be administered.
    if (action === "demote") {
        const groupPlan = await getGroupPlan(groupData);
        assertFeature(
            groupPlan,
            "memberRole",
            `On the ${groupPlan.config.name} plan every participant is an admin. Upgrade this group's plan to add members who can't manage it.`
        );
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

export const addContributionService = async (data: {group: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, contribution: number, description: string, category?: string}) => {
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

        // Resolve which credit category the contribution lands in. A chosen
        // category must be a non-deleted CREDIT category of this group;
        // otherwise it falls back to the group's "Other" credit category.
        let creditCategoryId;
        if (data.category && mongoose.Types.ObjectId.isValid(data.category)) {
            const chosen = await Category.findOne({
                _id: data.category,
                groupId: groupData,
                type: "CREDIT",
                isDeleted: false,
            }).session(session);
            if (!chosen) throw new AppError("Invalid credit category", 400);
            creditCategoryId = chosen._id;
        } else {
            const other = await getOrCreateOtherCreditCategory(groupData, session);
            creditCategoryId = other._id;
        }

        const AddContributionMember = await adjustMemberContribution(groupData, userId, contribution, { session });

        await creditGroupBalance(groupData, contribution, { session });

        const AddContributionLog = new GroupTransaction({
            groupId: groupData,
            amount: contribution,
            action: "CREDIT",
            description: `Added ${contribution} contribution to group ${description ? `with description: ${description}` : ""}`,
            referenceId: userId,
            referenceModel: "User",
            category: creditCategoryId,
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

    // Before either exit path. Forfeiting would leave the chit a member short
    // just as surely as settling out does, so the guard sits above the branch.
    await assertMemberFreeOfChit(groupData, userId);

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
    await assertMemberFreeOfChit(groupData, memberId);
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
    // The group's own effective entitlement. Shipping it here is what lets the UI
    // gate on the same plan the backend will enforce — every member of a Pro
    // group sees Pro controls, regardless of what any of them bought elsewhere.
    //
    // Derived from the document already in hand rather than calling getGroupPlan,
    // which would re-fetch the same group on the app's hottest endpoint. The
    // closed-group branch mirrors that helper exactly: a frozen snapshot wins
    // over the (now meaningless) expiry clock.
    const subscription = toPlanView(
        group.status === "CLOSED" && group.planSnapshot?.tier
            ? getEffectivePlan({ plan: group.planSnapshot.tier, planExpiresAt: null })
            : getEffectivePlan({ plan: group.plan, planExpiresAt: group.planExpiresAt })
    );
    // The group's TYPE and the features it grants, resolved server-side and
    // shipped alongside the subscription for the same reason: the UI must gate on
    // the identical answer the API enforces. `purpose` is already on the payload,
    // but leaving the client to re-derive the type from it would duplicate the
    // legacy-value mapping and let the two drift.
    const { type: groupTypeName, features } = toGroupTypeView(group.purpose);
    const groupData = {
        ...group.toObject(),
        role: currentUser.role,
        barLength,
        subscription,
        groupTypeName,
        features,
    };
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
        const groupPlan = await getGroupPlan(groupId);
        const floor = retentionFloor(groupPlan, "transaction");
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
        const groupPlan = await getGroupPlan(groupId);
        const floor = retentionFloor(groupPlan, "transaction");
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

        // A chit contribution is not an ordinary credit, and removing it here
        // would only reverse half of it: the wallet and the member's total would
        // roll back while the chit due went on claiming it was paid, and the
        // cycle's collected total would be overstated forever. The chit page owns
        // the undo, which reverses all four together.
        if ((credit.metadata as Record<string, unknown> | undefined)?.chitDueId) {
            throw new AppError(
                "This is a chit contribution. Undo it from the group's chit page so the cycle stays in step.",
                400
            );
        }

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
        const groupPlan = await getGroupPlan(groupId);
        const floor = retentionFloor(groupPlan, "event");
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