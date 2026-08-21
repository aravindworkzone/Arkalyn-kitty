import mongoose from 'mongoose';
import Group from '../models/group.model';
import GroupMember from '../models/group_member.model';
import GroupLink, { type IGroupLink } from '../models/group_link.model';
import GroupTransaction from '../models/group_transaction.model';
import GroupEvent from '../models/group_event.model';
import Expense from '../models/expense.model';
import { AppError } from '../helpers/AppError';
import { creditGroupBalance, debitGroupBalance } from '../helpers/balanceOps';
import { fromDBAmount } from '../helpers/Money';
import { getGroupPlan } from '../helpers/planLimits';
import { assertGroupTypeFeature, receiveFundingDeniedMessage } from '../helpers/groupTypes';
import { getOrCreateOtherCreditCategory } from './category.service';
import { createNotification } from './notification.service';
import type { NotificationType } from '../models/notification.model';

/**
 * Group-to-group funding links.
 *
 * The money model is deliberately PRE-PAID: an admin of the source group pushes
 * a lump sum into the host's wallet, and the host then spends it through the
 * ordinary expense flow. Nothing here debits two wallets at expense time —
 * `Expense.fundedByGroup` is attribution only. That keeps the invariant every
 * other money path relies on: an expense debits exactly the group it belongs to.
 *
 * Direction is never inferred. Money flows source -> host, and only an admin of
 * the SOURCE can move it. The host can request a link and can spend what it has
 * been given, but it can never reach into the source's wallet.
 */

type Id = mongoose.Types.ObjectId;

/** Everyone who can act on a link for a group, used for notification fan-out. */
const adminsOf = async (groupId: Id, session?: mongoose.ClientSession) => {
    const query = GroupMember.find({
        groupId,
        role: { $in: ['SUPER_ADMIN', 'ADMIN'] },
        isDeleted: false,
    }).select('userId');
    if (session) query.session(session);
    return query;
};

const notifyAdmins = async (
    groupId: Id,
    actor: Id,
    type: NotificationType,
    metadata: Record<string, unknown>
) => {
    const admins = await adminsOf(groupId);
    // Notifications are best-effort and deliberately outside any transaction —
    // a failed notify must never roll back a committed transfer.
    await Promise.all(
        admins
            .filter((a) => String(a.userId) !== String(actor))
            .map((a) =>
                createNotification({ recipient: a.userId, actor, group: groupId, type, metadata })
            )
    );
};

/**
 * An admin of the host asks a source group for a funding link, addressing it by
 * displayId — the group analogue of inviting a user by email.
 */
export const requestLinkService = async (data: {
    hostGroup: Id;
    sourceGroupRef: string;
    requestedBy: Id;
}) => {
    const { hostGroup, sourceGroupRef, requestedBy } = data;

    const ref = sourceGroupRef?.trim();
    if (!ref) throw new AppError('Group ID is required', 400);

    // Same resolution rule as loadGroup: an ObjectId or a Grp-YY-NNN displayId.
    const source = await Group.findOne(
        mongoose.isValidObjectId(ref) ? { _id: ref } : { displayId: ref }
    );
    if (!source) throw new AppError('Group not found', 404);

    if (String(source._id) === String(hostGroup)) {
        throw new AppError('A group cannot be connected to itself', 400);
    }
    if (source.status === 'CLOSED') {
        throw new AppError('That group is closed and cannot fund another group', 400);
    }

    // Only a Reserve group may bankroll another. Checked on the source that was
    // just resolved, not on req.group — the host is the acting group here, and the
    // funder is named in the body, which is why this gate is a service check
    // rather than router middleware.
    //
    // This lands on link FORMATION (here and on approve), never on /transfer. A
    // transfer acts on a link that is already ACTIVE, so links approved before
    // this rule existed keep working untouched — grandfathering falls out of
    // where the gate sits, with no flag and no migration.
    assertGroupTypeFeature(
        source.purpose,
        'fundOthers',
        `"${source.name}" is not a Reserve group. Only a Reserve group can fund another group.`
    );

    // ...and the mirror rule on the HOST: a chit is funded only by its own
    // members. Checked here rather than in router middleware for the same reason
    // the source check is — the two halves of one rule belong side by side, where
    // a reader can see that formation is gated on both ends and /transfer on
    // neither. One projected read; the host document is not otherwise needed.
    const host = await Group.findById(hostGroup).select('purpose name');
    if (!host) throw new AppError('Group not found', 404);
    assertGroupTypeFeature(
        host.purpose,
        'receiveFunding',
        receiveFundingDeniedMessage(host.name)
    );

    // A pair funding each other in both directions makes the contributed totals
    // meaningless, so one live direction at a time.
    const opposite = await GroupLink.findOne({
        hostGroupId: source._id,
        sourceGroupId: hostGroup,
        status: { $in: ['PENDING', 'ACTIVE'] },
        isDeleted: false,
    });
    if (opposite) {
        throw new AppError('These groups are already connected the other way round', 409);
    }

    const existing = await GroupLink.findOne({
        hostGroupId: hostGroup,
        sourceGroupId: source._id,
        status: { $in: ['PENDING', 'ACTIVE'] },
        isDeleted: false,
    });
    if (existing) {
        throw new AppError(
            existing.status === 'ACTIVE'
                ? 'These groups are already connected'
                : 'A connection request is already pending',
            409
        );
    }

    let link: IGroupLink;
    try {
        link = await GroupLink.create({
            hostGroupId: hostGroup,
            sourceGroupId: source._id,
            requestedBy,
        });
    } catch (error: any) {
        // The partial unique index is the backstop against a double request
        // racing the check above.
        if (error.code === 11000) throw new AppError('A connection request is already pending', 409);
        throw error;
    }

    await notifyAdmins(source._id as Id, requestedBy, 'GROUP_LINK_REQUESTED', {
        linkId: String(link._id),
        hostGroupId: String(hostGroup),
    });

    return link;
};

/**
 * An admin of the SOURCE answers the request. Verifying that the link's
 * sourceGroupId matches the group the caller was authorized against is the
 * security boundary — without it, an admin of any group could approve a link
 * that names their group as the funder.
 */
const reviewLink = async (data: {
    sourceGroup: Id;
    linkId: Id;
    reviewer: Id;
    approve: boolean;
}) => {
    const { sourceGroup, linkId, reviewer, approve } = data;

    const link = await GroupLink.findOne({ _id: linkId, isDeleted: false });
    if (!link) throw new AppError('Connection request not found', 404);
    if (String(link.sourceGroupId) !== String(sourceGroup)) {
        throw new AppError('This request is not addressed to your group', 403);
    }
    if (link.status !== 'PENDING') {
        throw new AppError('This request has already been answered', 409);
    }

    const host = await Group.findById(link.hostGroupId).select('status');
    if (!host) throw new AppError('Group not found', 404);
    if (approve && host.status === 'CLOSED') {
        throw new AppError('That group has been closed', 400);
    }

    // Approving is the other half of link formation, so the funding-source rule is
    // enforced here too — not only on /request. It closes the case where a group's
    // type stopped qualifying between the request and the answer, and it means the
    // rule holds even for a request written directly to the database.
    //
    // Only on the approve branch. Rejecting must stay available whatever the
    // group's type: saying no is never gated.
    if (approve) {
        const sourceGroupDoc = await Group.findById(sourceGroup).select('purpose name');
        if (!sourceGroupDoc) throw new AppError('Group not found', 404);
        assertGroupTypeFeature(
            sourceGroupDoc.purpose,
            'fundOthers',
            'Only a Reserve group can fund another group, so this connection cannot be approved.'
        );

        // The host may have been a Chit all along — the request predates this
        // rule — or the rule may simply not have run on its path. Either way an
        // approval is the last moment before money can move, so both ends are
        // re-checked here rather than trusted from the request.
        const hostGroupDoc = await Group.findById(link.hostGroupId).select('purpose name');
        if (!hostGroupDoc) throw new AppError('Group not found', 404);
        assertGroupTypeFeature(
            hostGroupDoc.purpose,
            'receiveFunding',
            receiveFundingDeniedMessage(hostGroupDoc.name)
        );
    }

    link.status = approve ? 'ACTIVE' : 'REJECTED';
    link.reviewedBy = reviewer;
    link.reviewedAt = new Date();
    await link.save();

    await GroupEvent.create({
        groupId: sourceGroup,
        performedBy: reviewer,
        eventType: 'GROUP_LINK_UPDATED',
        referenceId: link.hostGroupId,
        referenceModel: 'Group',
        metadata: { linkId: String(link._id), status: link.status },
    });

    await notifyAdmins(
        link.hostGroupId as Id,
        reviewer,
        approve ? 'GROUP_LINK_APPROVED' : 'GROUP_LINK_REJECTED',
        { linkId: String(link._id), sourceGroupId: String(sourceGroup) }
    );

    return link;
};

export const approveLinkService = (data: { sourceGroup: Id; linkId: Id; reviewer: Id }) =>
    reviewLink({ ...data, approve: true });

export const rejectLinkService = (data: { sourceGroup: Id; linkId: Id; reviewer: Id }) =>
    reviewLink({ ...data, approve: false });

/**
 * The only path that moves money. Mirrors addContributionService's transaction
 * skeleton, but spans two wallets.
 *
 * Every amount handed to the balanceOps helpers is RAW RUPEES — the schema
 * setter converts to cents. Pre-converting here would double-scale it.
 */
export const transferToLinkedGroupService = async (data: {
    sourceGroup: Id;
    linkId: Id;
    amount: number;
    description?: string;
    performedBy: Id;
}) => {
    const { sourceGroup, linkId, amount, description, performedBy } = data;

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        throw new AppError('Amount must be a positive number', 400);
    }

    const link = await GroupLink.findOne({ _id: linkId, isDeleted: false });
    if (!link) throw new AppError('Connection not found', 404);
    if (String(link.sourceGroupId) !== String(sourceGroup)) {
        throw new AppError('Your group does not fund that group', 403);
    }
    if (link.status !== 'ACTIVE') {
        throw new AppError('This connection is not active', 409);
    }

    // The host may have closed since the link was approved.
    const host = await Group.findById(link.hostGroupId).select('status name displayId');
    if (!host) throw new AppError('Group not found', 404);
    if (host.status === 'CLOSED') {
        throw new AppError('That group is closed and cannot receive funds', 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // Atomic overspend guard: a null return means the balance was
        // insufficient, and the check-and-write could not interleave.
        const debited = await debitGroupBalance(sourceGroup, amount, { session });
        if (!debited) throw new AppError('Amount cannot be greater than group balance', 400);

        await creditGroupBalance(link.hostGroupId, amount, { session });

        const creditCategory = await getOrCreateOtherCreditCategory(
            link.hostGroupId as Id,
            session
        );

        await new GroupTransaction({
            groupId: sourceGroup,
            amount,
            action: 'DEBIT',
            description: `Funded group ${host.displayId}${description ? ` — ${description}` : ''}`,
            referenceId: link.hostGroupId,
            referenceModel: 'Group',
            metadata: { linkId: String(link._id), direction: 'OUTGOING' },
            performedBy,
        }).save({ session });

        await new GroupTransaction({
            groupId: link.hostGroupId,
            amount,
            action: 'CREDIT',
            description: `Funding received from a connected group${description ? ` — ${description}` : ''}`,
            referenceId: sourceGroup,
            referenceModel: 'Group',
            category: creditCategory._id,
            metadata: { linkId: String(link._id), direction: 'INCOMING' },
            performedBy,
        }).save({ session });

        // Raw rupees — $inc re-runs the schema setter.
        await GroupLink.updateOne(
            { _id: link._id },
            { $inc: { contribution: amount } },
            { session }
        );

        await GroupEvent.create(
            [
                {
                    groupId: sourceGroup,
                    performedBy,
                    eventType: 'GROUP_LINK_TRANSFER',
                    referenceId: link.hostGroupId,
                    referenceModel: 'Group',
                    amount,
                    metadata: { linkId: String(link._id), direction: 'OUTGOING' },
                },
                {
                    groupId: link.hostGroupId,
                    performedBy,
                    eventType: 'GROUP_LINK_TRANSFER',
                    referenceId: sourceGroup,
                    referenceModel: 'Group',
                    amount,
                    metadata: { linkId: String(link._id), direction: 'INCOMING' },
                },
            ],
            { session, ordered: true }
        );

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        if (error instanceof AppError) throw error;
        if (error.name === 'ValidationError') throw new AppError(error.message, 400);
        throw new AppError(error.message || 'Internal server error', error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    await notifyAdmins(link.hostGroupId as Id, performedBy, 'GROUP_LINK_FUNDED', {
        linkId: String(link._id),
        sourceGroupId: String(sourceGroup),
        amount,
    });

    return GroupLink.findById(link._id);
};

/**
 * Either side can tear down a link. Money already transferred stays where it is
 * — it was a contribution, not a loan — so this only stops further funding and
 * further attribution.
 */
export const revokeLinkService = async (data: { group: Id; linkId: Id; performedBy: Id }) => {
    const { group, linkId, performedBy } = data;

    const link = await GroupLink.findOne({ _id: linkId, isDeleted: false });
    if (!link) throw new AppError('Connection not found', 404);

    const isHost = String(link.hostGroupId) === String(group);
    const isSource = String(link.sourceGroupId) === String(group);
    if (!isHost && !isSource) throw new AppError('Your group is not part of that connection', 403);

    if (link.status !== 'ACTIVE' && link.status !== 'PENDING') {
        throw new AppError('This connection is not active', 409);
    }

    link.status = 'REVOKED';
    await link.save();

    await GroupEvent.create({
        groupId: group,
        performedBy,
        eventType: 'GROUP_LINK_UPDATED',
        referenceId: isHost ? link.sourceGroupId : link.hostGroupId,
        referenceModel: 'Group',
        metadata: { linkId: String(link._id), status: 'REVOKED' },
    });

    // Tell the other side, whichever that is.
    await notifyAdmins(
        (isHost ? link.sourceGroupId : link.hostGroupId) as Id,
        performedBy,
        'GROUP_LINK_REVOKED',
        { linkId: String(link._id), byGroupId: String(group) }
    );

    return link;
};

/**
 * Both directions for one group, with the spend already attributed to each
 * incoming link so the UI can show "₹4,200 of ₹5,000 used" without a second
 * round trip.
 */
export const getGroupLinksService = async (groupId: Id) => {
    const [incoming, outgoing] = await Promise.all([
        GroupLink.find({ hostGroupId: groupId, isDeleted: false })
            .populate('sourceGroupId', 'name displayId status')
            .populate('requestedBy', 'name')
            .sort({ createdAt: -1 }),
        GroupLink.find({ sourceGroupId: groupId, isDeleted: false })
            .populate('hostGroupId', 'name displayId status balance')
            .populate('requestedBy', 'name')
            .sort({ createdAt: -1 }),
    ]);

    // How much of each funder's money this group has tagged onto expenses.
    // Aggregation bypasses the schema getter, so these totals come back in cents
    // and have to be converted explicitly.
    const spendRows = await Expense.aggregate<{ _id: mongoose.Types.ObjectId; cents: number }>([
        { $match: { groupId, isDeleted: false, fundedByGroup: { $ne: null } } },
        { $group: { _id: '$fundedByGroup', cents: { $sum: '$amount' } } },
    ]);
    const spentBySource = new Map(
        spendRows.map((r) => [String(r._id), fromDBAmount(r.cents)])
    );

    // Whether each counterpart host is on a plan that can receive funding. The
    // host pays for the connection, so on an OUTGOING link that fact belongs to
    // the other group and the source cannot read it off its own plan — without
    // this the UI would offer a transfer that the gate then refuses.
    //
    // Resolved through getGroupPlan itself rather than re-deriving the rule, so
    // the button and the middleware can never disagree. Outgoing links per group
    // are few, so the fan-out is bounded.
    const hostPlans = await Promise.all(
        outgoing.map((l) => getGroupPlan(((l.hostGroupId as any)?._id ?? l.hostGroupId) as Id))
    );

    return {
        incoming: incoming.map((l) => ({
            ...l.toJSON(),
            attributedSpend: spentBySource.get(String((l.sourceGroupId as any)?._id)) ?? 0,
        })),
        outgoing: outgoing.map((l, i) => ({
            ...l.toJSON(),
            hostCanReceive: hostPlans[i].features.linkGroups,
        })),
    };
};

/**
 * Used by the expense service to confirm a chosen funding group really is an
 * active funder of this group. Returns the link, or null.
 */
export const findActiveFunderLink = async (
    hostGroupId: Id,
    sourceGroupId: Id | string,
    session?: mongoose.ClientSession
) => {
    if (!mongoose.isValidObjectId(sourceGroupId)) return null;
    const query = GroupLink.findOne({
        hostGroupId,
        sourceGroupId,
        status: 'ACTIVE',
        isDeleted: false,
    });
    if (session) query.session(session);
    return query;
};
