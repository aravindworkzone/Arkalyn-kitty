import mongoose from 'mongoose';
import { AppError } from '../helpers/AppError';
import Group from '../models/group.model';
import GroupMember from '../models/group_member.model';
import GroupInvite from '../models/group_invite.model';
import GroupJoinLink, { generateJoinToken } from '../models/group_join_link.model';
import { createNotification } from './notification.service';
import { getGroupPlan, assertWithinLimit } from '../helpers/planLimits';

/**
 * Shareable join links.
 *
 * The whole point of this file is that it does NOT own an approval flow. A join
 * request made through a link is written as a GroupInvite in PENDING_APPROVAL —
 * exactly the state an emailed invite reaches once the invitee accepts — so
 * approveJoinService, declineJoinService, the admin queue and the notifications
 * all work on it unchanged. A link is a new *entry point*, not a second path to
 * membership.
 */

type Id = mongoose.Types.ObjectId;

/** Creates a link, retiring whichever one was live before. */
export const createJoinLinkService = async (data: { group: Id; createdBy: Id }) => {
    const { group, createdBy } = data;

    const groupDoc = await Group.findById(group).select('status');
    if (!groupDoc) throw new AppError('Group not found', 404);
    if (groupDoc.status === 'CLOSED') {
        throw new AppError('Group is closed — no further changes are allowed', 403);
    }

    // Retire first: the partial unique index allows only one active row per
    // group, so rotating has to free the slot before claiming it again.
    await GroupJoinLink.updateMany({ groupId: group, isActive: true }, { $set: { isActive: false } });

    return GroupJoinLink.create({ groupId: group, token: generateJoinToken(), createdBy });
};

export const getJoinLinkService = async (group: Id) =>
    GroupJoinLink.findOne({ groupId: group, isActive: true }).populate('createdBy', 'name');

export const revokeJoinLinkService = async (data: { group: Id }) => {
    const result = await GroupJoinLink.updateMany(
        { groupId: data.group, isActive: true },
        { $set: { isActive: false } }
    );
    if (result.matchedCount === 0) throw new AppError('There is no active join link', 404);
    return { revoked: result.modifiedCount };
};

/** Resolves a token to its live link, or explains why it is not usable. */
const resolveToken = async (token: string) => {
    const raw = token?.trim();
    if (!raw) throw new AppError('Invalid join link', 400);

    const link = await GroupJoinLink.findOne({ token: raw });
    // A revoked link and a made-up one are reported identically, so the token
    // space cannot be probed for which groups exist.
    if (!link || !link.isActive) throw new AppError('This join link is no longer valid', 404);
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
        throw new AppError('This join link has expired', 404);
    }

    const group = await Group.findById(link.groupId).select('name displayId status');
    if (!group) throw new AppError('Group not found', 404);

    return { link, group };
};

/**
 * What the joiner sees before committing. Reports their own standing with the
 * group so the page can say "you're already a member" instead of failing on
 * submit.
 */
export const previewJoinLinkService = async (token: string, userId: Id) => {
    const { group } = await resolveToken(token);

    const [isMember, pendingInvite, memberCount] = await Promise.all([
        GroupMember.findOne({ groupId: group._id, userId, isDeleted: false }),
        GroupInvite.findOne({
            groupId: group._id,
            invitedUser: userId,
            status: { $in: ['PENDING', 'PENDING_APPROVAL'] },
        }),
        GroupMember.countDocuments({ groupId: group._id, isDeleted: false }),
    ]);

    return {
        group: {
            _id: group._id,
            name: group.name,
            displayId: group.displayId,
            status: group.status,
        },
        memberCount,
        alreadyMember: Boolean(isMember),
        // PENDING means they were separately invited by email and haven't
        // answered; PENDING_APPROVAL means they already asked and are queued.
        pendingStatus: pendingInvite?.status ?? null,
    };
};

/**
 * Turns a link click into a join request. Mirrors acceptInviteService's guards,
 * because it lands in the same queue and must not be a weaker way in.
 */
export const joinViaLinkService = async (data: {
    token: string;
    userId: Id;
    contribution: number;
}) => {
    const { token, userId, contribution } = data;

    if (typeof contribution !== 'number' || contribution < 0) {
        throw new AppError('Contribution cannot be negative', 400);
    }

    const { link, group } = await resolveToken(token);

    if (group.status === 'CLOSED') {
        throw new AppError('Group is closed — no further changes are allowed', 403);
    }

    const existingMember = await GroupMember.findOne({
        groupId: group._id,
        userId,
        isDeleted: false,
    });
    if (existingMember) throw new AppError('You are already a member of this group', 400);

    // PENDING_APPROVAL rows sit outside GroupInvite's partial unique index, so
    // this check is the only thing stopping one person queuing twice.
    const openInvite = await GroupInvite.findOne({
        groupId: group._id,
        invitedUser: userId,
        status: { $in: ['PENDING', 'PENDING_APPROVAL'] },
    });
    if (openInvite) {
        throw new AppError(
            openInvite.status === 'PENDING_APPROVAL'
                ? 'Your request is already waiting for an admin to approve it'
                : 'You already have an invite to this group — respond to that instead',
            400
        );
    }

    // Soft check, same as acceptInviteService: fail early rather than queue a
    // request the group has no room for. Re-checked as a hard cap on approval.
    const groupPlan = await getGroupPlan(group._id as Id);
    const memberCount = await GroupMember.countDocuments({ groupId: group._id, isDeleted: false });
    assertWithinLimit(
        memberCount,
        groupPlan.limits.maxMembersPerGroup,
        `This group is full (${groupPlan.limits.maxMembersPerGroup}-member limit on the ${groupPlan.config.name} plan). Ask a group admin to upgrade its plan.`
    );

    // Written straight to PENDING_APPROVAL: there is nobody to "accept" a link
    // invite — clicking it IS the acceptance. `invitedBy` records whoever
    // created the link, which is who effectively did the inviting.
    const invite = await GroupInvite.create({
        groupId: group._id,
        invitedUser: userId,
        invitedBy: link.createdBy,
        status: 'PENDING_APPROVAL',
        contribution,
        respondedAt: new Date(),
    });

    const admins = await GroupMember.find({
        groupId: group._id,
        role: { $in: ['ADMIN', 'SUPER_ADMIN'] },
        isDeleted: false,
    });
    await Promise.all(
        admins.map((admin) =>
            createNotification({
                recipient: admin.userId,
                actor: userId,
                group: group._id as Id,
                type: 'JOIN_APPROVAL_REQUESTED',
                metadata: {
                    inviteId: String(invite._id),
                    groupName: group.name,
                    contribution,
                    viaJoinLink: true,
                },
            })
        )
    );

    return {
        groupName: group.name,
        message: 'Request sent — waiting for a group admin to approve you',
    };
};
