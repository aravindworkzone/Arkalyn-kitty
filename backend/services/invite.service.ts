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
    if (invite.status !== "PENDING") {
        throw new AppError("This invite has already been responded to", 400);
    }

    const group = await Group.findById(invite.groupId);
    if (!group) throw new AppError("Group not found", 404);

    const existingMember = await GroupMember.findOne({ groupId: invite.groupId, userId, isDeleted: false });
    if (existingMember) throw new AppError("You are already a member of this group", 400);

    // Subscription gate (hard cap): the group can't grow past the owner's
    // member limit even if an older invite is still pending.
    const ownerPlan = await getGroupOwnerPlan(invite.groupId);
    const memberCount = await GroupMember.countDocuments({ groupId: invite.groupId, isDeleted: false });
    assertWithinLimit(
        memberCount,
        ownerPlan.limits.maxMembersPerGroup,
        `This group is full (${ownerPlan.limits.maxMembersPerGroup}-member limit on the ${ownerPlan.config.name} plan). Ask the group owner to upgrade.`
    );

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        invite.status = "ACCEPTED";
        invite.respondedAt = new Date();
        await invite.save({ session });

        const newMember = new GroupMember({
            groupId: invite.groupId,
            userId,
            contribution,
            role: "MEMBER",
        });
        await newMember.save({ session });

        await creditGroupBalance(invite.groupId, contribution, { session });

        const otherCreditCategory = await getOrCreateOtherCreditCategory(invite.groupId, session);

        const event = new GroupEvent({
            groupId: invite.groupId,
            performedBy: userId,
            eventType: "MEMBER_ADDED",
            metadata: { userId, note: `Accepted invite and joined with ${contribution} contribution` },
            referenceId: userId,
            referenceModel: "User",
        });
        await event.save({ session });

        const transaction = new GroupTransaction({
            groupId: invite.groupId,
            amount: contribution,
            action: "CREDIT",
            description: `Joined group with ${contribution} contribution`,
            referenceId: userId,
            referenceModel: "User",
            category: otherCreditCategory._id,
            metadata: [{ userId, contribution }],
            performedBy: userId,
        });
        await transaction.save({ session });

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        if (error.code === 11000) throw new AppError("You are already a member of this group", 409);
        if (error.name === "ValidationError") throw new AppError(error.message, 400);
        throw new AppError(error.message || "Internal server error", error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    await markInviteNotificationsRead(userId, inviteId, "ACCEPTED");

    await createNotification({
        recipient: invite.invitedBy,
        actor: userId,
        group: invite.groupId,
        type: "INVITE_ACCEPTED",
        metadata: { inviteId, groupName: group.name },
    });

    emitToGroup(group.displayId, SOCKET_EVENTS.GROUP_MEMBER_ADDED);

    return "Invite accepted";
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
