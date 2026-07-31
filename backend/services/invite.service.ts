import mongoose from "mongoose";
import { AppError } from "../helpers/AppError";
import Group from "../models/group.model";
import GroupMember from "../models/group_member.model";
import GroupEvent from "../models/group_event.model";
import GroupTransaction from "../models/group_transaction.model";
import GroupInvite from "../models/group_invite.model";
import Notification from "../models/notification.model";
import { createNotification } from "./notification.service";
import { getOrCreateOtherCreditCategory } from "./category.service";
import { emitToGroup } from "../sockets";
import { SOCKET_EVENTS } from "../sockets/events";
import { creditGroupBalance } from "../helpers/balanceOps";
import { getGroupOwnerPlan, assertWithinLimit } from "../helpers/planLimits";

const markInviteNotificationsRead = async (
    recipient: mongoose.Types.ObjectId,
    inviteId: string,
    response: "ACCEPTED" | "REJECTED"
) => {
    // Recording the response on the notification lets the client swap the
    // Accept/Reject buttons for a static "you accepted/rejected" status.
    await Notification.updateMany(
        { recipient, type: "GROUP_INVITE", "metadata.inviteId": inviteId },
        { $set: { read: true, "metadata.inviteResponse": response } }
    );
};

export const acceptInviteService = async (data: { inviteId: string; userId: mongoose.Types.ObjectId; contribution: number }) => {
    const { inviteId, userId, contribution } = data;

    if (!mongoose.Types.ObjectId.isValid(inviteId)) {
        throw new AppError("Invalid invite ID format", 400);
    }
    if (typeof contribution !== "number" || contribution < 0) {
        throw new AppError("Contribution cannot be negative", 400);
    }

    const invite = await GroupInvite.findById(inviteId);
    if (!invite) throw new AppError("Invite not found", 404);
    if (invite.invitedUser.toString() !== userId.toString()) {
        throw new AppError("This invite does not belong to you", 403);
    }
    if (invite.status === "PENDING_APPROVAL") {
        throw new AppError("Your request is already waiting for an admin to approve it", 400);
    }
    if (invite.status !== "PENDING") {
        throw new AppError("This invite has already been responded to", 400);
    }

    const group = await Group.findById(invite.groupId);
    if (!group) throw new AppError("Group not found", 404);
    if (group.status === "CLOSED") {
        throw new AppError("Group is closed — no further changes are allowed", 403);
    }

    const existingMember = await GroupMember.findOne({ groupId: invite.groupId, userId, isDeleted: false });
    if (existingMember) throw new AppError("You are already a member of this group", 400);

    // Subscription gate (soft check): fail early rather than queue a request the
    // group has no room for. Re-checked as a hard cap when an admin approves.
    const ownerPlan = await getGroupOwnerPlan(invite.groupId);
    const memberCount = await GroupMember.countDocuments({ groupId: invite.groupId, isDeleted: false });
    assertWithinLimit(
        memberCount,
        ownerPlan.limits.maxMembersPerGroup,
        `This group is full (${ownerPlan.limits.maxMembersPerGroup}-member limit on the ${ownerPlan.config.name} plan). Ask the group owner to upgrade.`
    );

    // Acceptance no longer joins the group — it parks the declared contribution
    // on the invite and hands it to the admins. Membership and the balance
    // credit happen together in approveJoinService.
    invite.status = "PENDING_APPROVAL";
    invite.contribution = contribution;
    invite.respondedAt = new Date();
    await invite.save();

    await markInviteNotificationsRead(userId, inviteId, "ACCEPTED");

    const admins = await GroupMember.find({
        groupId: invite.groupId,
        role: { $in: ["ADMIN", "SUPER_ADMIN"] },
        isDeleted: false,
    });
    await Promise.all(
        admins.map((admin) =>
            createNotification({
                recipient: admin.userId,
                actor: userId,
                group: invite.groupId,
                type: "JOIN_APPROVAL_REQUESTED",
                metadata: { inviteId, groupName: group.name, contribution },
            })
        )
    );

    return "Invite accepted — waiting for a group admin to approve you";
};

export const approveJoinService = async (data: {
    group: mongoose.Types.ObjectId;
    inviteId: string;
    reviewer: mongoose.Types.ObjectId;
}) => {
    const { group: groupId, inviteId, reviewer } = data;

    if (!mongoose.Types.ObjectId.isValid(inviteId)) {
        throw new AppError("Invalid invite ID format", 400);
    }

    const invite = await GroupInvite.findById(inviteId);
    if (!invite) throw new AppError("Invite not found", 404);
    if (invite.groupId.toString() !== groupId.toString()) {
        throw new AppError("This request belongs to another group", 403);
    }
    if (invite.status !== "PENDING_APPROVAL") {
        throw new AppError("This request is not waiting for approval", 400);
    }

    const group = await Group.findById(groupId);
    if (!group) throw new AppError("Group not found", 404);

    const joiner = invite.invitedUser;
    const contribution = invite.contribution;

    const existingMember = await GroupMember.findOne({ groupId, userId: joiner, isDeleted: false });
    if (existingMember) throw new AppError("This user is already a member of this group", 400);

    // Hard cap: the group may have filled up while the request sat in the queue.
    const ownerPlan = await getGroupOwnerPlan(groupId);
    const memberCount = await GroupMember.countDocuments({ groupId, isDeleted: false });
    assertWithinLimit(
        memberCount,
        ownerPlan.limits.maxMembersPerGroup,
        `This group is full (${ownerPlan.limits.maxMembersPerGroup}-member limit on the ${ownerPlan.config.name} plan). Upgrade the plan to admit more members.`
    );

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        invite.status = "ACCEPTED";
        invite.reviewedBy = reviewer;
        invite.reviewedAt = new Date();
        await invite.save({ session });

        const newMember = new GroupMember({
            groupId,
            userId: joiner,
            contribution,
            role: "MEMBER",
        });
        await newMember.save({ session });

        await creditGroupBalance(groupId, contribution, { session });

        const otherCreditCategory = await getOrCreateOtherCreditCategory(groupId, session);

        const event = new GroupEvent({
            groupId,
            performedBy: reviewer,
            eventType: "MEMBER_ADDED",
            metadata: { userId: joiner, note: `Join approved — joined with ${contribution} contribution` },
            referenceId: joiner,
            referenceModel: "User",
        });
        await event.save({ session });

        const transaction = new GroupTransaction({
            groupId,
            amount: contribution,
            action: "CREDIT",
            description: `Joined group with ${contribution} contribution`,
            referenceId: joiner,
            referenceModel: "User",
            category: otherCreditCategory._id,
            metadata: [{ userId: joiner, contribution }],
            performedBy: reviewer,
        });
        await transaction.save({ session });

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        if (error.code === 11000) throw new AppError("This user is already a member of this group", 409);
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    await createNotification({
        recipient: joiner,
        actor: reviewer,
        group: groupId,
        type: "JOIN_APPROVED",
        metadata: { inviteId, groupName: group.name, groupDisplayId: group.displayId },
    });

    // Tell the inviter their invite landed, now that it actually has.
    if (invite.invitedBy.toString() !== reviewer.toString()) {
        await createNotification({
            recipient: invite.invitedBy,
            actor: joiner,
            group: groupId,
            type: "INVITE_ACCEPTED",
            metadata: { inviteId, groupName: group.name },
        });
    }

    emitToGroup(group.displayId, SOCKET_EVENTS.GROUP_MEMBER_ADDED);

    return "Join request approved";
};

export const declineJoinService = async (data: {
    group: mongoose.Types.ObjectId;
    inviteId: string;
    reviewer: mongoose.Types.ObjectId;
}) => {
    const { group: groupId, inviteId, reviewer } = data;

    if (!mongoose.Types.ObjectId.isValid(inviteId)) {
        throw new AppError("Invalid invite ID format", 400);
    }

    const invite = await GroupInvite.findById(inviteId);
    if (!invite) throw new AppError("Invite not found", 404);
    if (invite.groupId.toString() !== groupId.toString()) {
        throw new AppError("This request belongs to another group", 403);
    }
    if (invite.status !== "PENDING_APPROVAL") {
        throw new AppError("This request is not waiting for approval", 400);
    }

    invite.status = "DECLINED";
    invite.reviewedBy = reviewer;
    invite.reviewedAt = new Date();
    await invite.save();

    const group = await Group.findById(groupId);

    await createNotification({
        recipient: invite.invitedUser,
        actor: reviewer,
        group: groupId,
        type: "JOIN_DECLINED",
        metadata: { inviteId, groupName: group?.name },
    });

    return "Join request declined";
};

export const getPendingJoinRequestsService = async (groupId: mongoose.Types.ObjectId) => {
    return GroupInvite.find({ groupId, status: "PENDING_APPROVAL" })
        .populate("invitedUser", "name email")
        .populate("invitedBy", "name")
        .sort({ respondedAt: -1 });
};

export const rejectInviteService = async (data: { inviteId: string; userId: mongoose.Types.ObjectId }) => {
    const { inviteId, userId } = data;

    if (!mongoose.Types.ObjectId.isValid(inviteId)) {
        throw new AppError("Invalid invite ID format", 400);
    }

    const invite = await GroupInvite.findById(inviteId);
    if (!invite) throw new AppError("Invite not found", 404);
    if (invite.invitedUser.toString() !== userId.toString()) {
        throw new AppError("This invite does not belong to you", 403);
    }
    if (invite.status !== "PENDING") {
        throw new AppError("This invite has already been responded to", 400);
    }

    invite.status = "REJECTED";
    invite.respondedAt = new Date();
    await invite.save();

    await markInviteNotificationsRead(userId, inviteId, "REJECTED");

    const group = await Group.findById(invite.groupId);

    await createNotification({
        recipient: invite.invitedBy,
        actor: userId,
        group: invite.groupId,
        type: "INVITE_REJECTED",
        metadata: { inviteId, groupName: group?.name },
    });

    return "Invite rejected";
};
