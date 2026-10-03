import mongoose from 'mongoose';
import Group from '../models/group.model';
import GroupMember from '../models/group_member.model';
import GroupLink, { type IGroupLink } from '../models/group_link.model';
import GroupTransaction from '../models/group_transaction.model';
import GroupEvent from '../models/group_event.model';
import Expense from '../models/expense.model';
import { AppError } from '../helpers/AppError';
import { debitGroupBalance, refundGroupBalance } from '../helpers/balanceOps';
import { fromDBAmount, toDBAmount } from '../helpers/Money';
import { getGroupPlan } from '../helpers/planLimits';
import { assertGroupTypeFeature, groupFeaturesOf, receiveFundingDeniedMessage } from '../helpers/groupTypes';
import { getOrCreateOtherCreditCategory } from './category.service';
import { createNotification } from './notification.service';
import type { NotificationType } from '../models/notification.model';

/**
 * Group-to-group credit lines — a Reserve group works like a credit card for
 * the Family groups it is linked to.
 *
 *  • A Reserve admin sets ONE fixed credit limit on the Reserve
 *    (setReserveLimitService). Contributions never change it.
 *  • Available credit = min(limit − lent out, wallet balance): the limit caps
 *    it, and the wallet must actually hold the money. A contribution refills a
 *    short wallet, up to the limit.
 *  • The host (a Family group) spends against it at expense time: the expense
 *    is debited from the RESERVE's wallet and added to the link's
 *    `outstanding` and the Reserve's `creditUsed` (total lent out), refused
 *    past available credit (drawOnCredit).
 *  • A host admin sends money to the Reserve whenever they like, up to its own
 *    wallet (sendToReserveService). It pays off what is owed first; the rest is
 *    a deposit into the Reserve.
 *  • Editing a credit expense down, or deleting it, gives the credit back
 *    (releaseCredit).
 *
 * No statements, due dates or interest: the link only tracks what is owed.
 *
 * The old gift model (a source pushing lump sums the host never repays) is
 * retired. Its totals stay on `contribution` as history and are never owed.
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
        receiveFundingDeniedMessage(host.name, host.purpose)
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
            receiveFundingDeniedMessage(hostGroupDoc.name, hostGroupDoc.purpose)
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

const money = (rupees: number) =>
    `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * What a Reserve can still lend: the fixed limit minus what is lent out, but
 * never more than its wallet actually holds.
 */
export const availableCreditOf = (g: { creditLimit?: number; creditUsed?: number; balance?: number }) =>
    Math.max(0, Math.min((g.creditLimit ?? 0) - (g.creditUsed ?? 0), g.balance ?? 0));

/**
 * A Reserve admin sets (or changes) the Reserve's fixed credit limit — the most
 * all its Family groups may owe it at once. Only this changes the limit;
 * contributions refill the wallet but leave the limit alone. Lowering it below
 * what is already lent out is allowed: it only stops new spending until enough
 * is repaid, the way a card issuer can cut a limit.
 */
export const setReserveLimitService = async (data: {
    reserveGroup: Id;
    creditLimit: number;
    performedBy: Id;
}) => {
    const { reserveGroup, creditLimit, performedBy } = data;

    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
        throw new AppError('Credit limit must be zero or more', 400);
    }

    const reserve = await Group.findById(reserveGroup).select('purpose');
    if (!reserve) throw new AppError('Group not found', 404);
    assertGroupTypeFeature(reserve.purpose, 'fundOthers', 'Only a Reserve group has a credit limit.');

    // Raw rupees — $set re-runs the schema setter.
    await Group.updateOne({ _id: reserveGroup }, { $set: { creditLimit } });

    await GroupEvent.create({
        groupId: reserveGroup,
        performedBy,
        eventType: 'GROUP_LINK_UPDATED',
        referenceId: reserveGroup,
        referenceModel: 'Group',
        amount: creditLimit,
        metadata: { creditLimit },
    });

    // Every borrower's available credit just changed, so all of them are told.
    const borrowers = await GroupLink.find({
        sourceGroupId: reserveGroup,
        status: 'ACTIVE',
        isDeleted: false,
    }).select('hostGroupId');
    await Promise.all(
        borrowers.map((l) =>
            notifyAdmins(l.hostGroupId as Id, performedBy, 'GROUP_LINK_CREDIT_LIMIT_SET', {
                linkId: String(l._id),
                sourceGroupId: String(reserveGroup),
                creditLimit,
            })
        )
    );

    return { creditLimit, hostGroupIds: borrowers.map((l) => l.hostGroupId as Id) };
};

/**
 * Charges an expense to a credit line, inside the expense's transaction. The
 * Reserve's wallet pays; the host's is untouched and owes the amount instead.
 *
 * Both guards run on the RESERVE document in one conditional update: the
 * wallet must cover the amount AND `creditUsed + amount ≤ creditLimit`; the
 * debit and the usage are applied together. Two Family groups drawing at once
 * both write that document, so the transaction makes one of them conflict
 * rather than both slipping past the limit or overdrawing the wallet.
 * Every amount handed to an update is RAW RUPEES — the schema setter converts;
 * only query filters need toDBAmount, since filters do not run setters.
 */
export const drawOnCredit = async (data: {
    linkId: Id;
    amount: number;
    expenseId: Id;
    title: string;
    performedBy: Id | string;
    session: mongoose.ClientSession;
}) => {
    const { linkId, amount, expenseId, title, performedBy, session } = data;

    const link = await GroupLink.findOne({ _id: linkId, status: 'ACTIVE', isDeleted: false }).session(session);
    if (!link) throw new AppError('That Reserve group no longer gives this group credit', 400);

    // $ifNull: Reserves from before the limit existed lack the fields, and a
    // missing field compares as null — which sorts below every number and
    // would wave the draw straight through.
    const cents = toDBAmount(amount);
    const reserve = await Group.findOneAndUpdate(
        {
            _id: link.sourceGroupId,
            balance: { $gte: cents },
            $expr: {
                $lte: [
                    { $add: [{ $ifNull: ['$creditUsed', 0] }, cents] },
                    { $ifNull: ['$creditLimit', 0] },
                ],
            },
        },
        { $inc: { balance: -amount, creditUsed: amount } },
        { new: true, session }
    );
    if (!reserve) {
        const current = await Group.findById(link.sourceGroupId)
            .select('balance creditLimit creditUsed')
            .session(session);
        const limit = current?.creditLimit ?? 0;
        if (!limit) throw new AppError('The Reserve group has not set a credit limit yet.', 400);
        const withinLimit = Math.max(0, limit - (current?.creditUsed ?? 0));
        const wallet = current?.balance ?? 0;
        throw new AppError(
            withinLimit <= wallet
                ? `Not enough Reserve credit: ${money(withinLimit)} left of the Reserve's ${money(limit)} limit.`
                : `Not enough Reserve credit: the Reserve's wallet has only ${money(wallet)}. A contribution to the Reserve refills it.`,
            400
        );
    }

    await GroupLink.updateOne({ _id: link._id }, { $inc: { outstanding: amount } }, { session });

    await GroupTransaction.create(
        [
            {
                groupId: link.sourceGroupId,
                amount,
                action: 'DEBIT',
                description: `Credit used: "${title}"`,
                referenceId: link.hostGroupId,
                referenceModel: 'Group',
                metadata: { linkId: String(link._id), expenseId: String(expenseId), kind: 'CREDIT_DRAW' },
                performedBy,
            },
        ],
        { session }
    );

    return link;
};

/**
 * Gives credit back when a credit expense is deleted or edited down.
 *
 * The amount is returned to the Reserve's wallet and taken off what is owed.
 * If the host has already repaid more than it now owes, the overpaid part goes
 * back to the host: e.g. ₹100 drawn, ₹100 repaid, expense deleted — the Reserve
 * would otherwise keep ₹100 for spending that never happened.
 */
export const releaseCredit = async (data: {
    linkId: Id;
    amount: number;
    title: string;
    performedBy: Id | string;
    session: mongoose.ClientSession;
}) => {
    const { linkId, amount, title, performedBy, session } = data;

    const link = await GroupLink.findById(linkId).session(session);
    if (!link) throw new AppError('Credit line not found', 404);

    const owed = link.outstanding ?? 0;
    const toReserve = Math.min(amount, owed);
    const toHost = parseFloat((amount - toReserve).toFixed(2));

    if (toReserve > 0) {
        await GroupLink.updateOne({ _id: link._id }, { $inc: { outstanding: -toReserve } }, { session });
        // Money back into the Reserve's wallet, and the shared limit freed.
        await Group.updateOne(
            { _id: link.sourceGroupId },
            { $inc: { balance: toReserve, creditUsed: -toReserve } },
            { session }
        );
        await GroupTransaction.create(
            [
                {
                    groupId: link.sourceGroupId,
                    amount: toReserve,
                    action: 'REFUND',
                    description: `Credit returned: "${title}"`,
                    referenceId: link.hostGroupId,
                    referenceModel: 'Group',
                    metadata: { linkId: String(link._id), kind: 'CREDIT_RELEASE' },
                    performedBy,
                },
            ],
            { session }
        );
    }

    if (toHost > 0) {
        await refundGroupBalance(link.hostGroupId, toHost, { session });
        await GroupTransaction.create(
            [
                {
                    groupId: link.hostGroupId,
                    amount: toHost,
                    action: 'REFUND',
                    description: `Overpaid Reserve credit returned: "${title}"`,
                    referenceId: link.sourceGroupId,
                    referenceModel: 'Group',
                    metadata: { linkId: String(link._id), kind: 'CREDIT_OVERPAID' },
                    performedBy,
                },
            ],
            { session }
        );
    }
};

/**
 * Metadata marker on every transaction a credit line writes into a group's
 * ledger. removeCreditService refuses rows carrying it: a repayment or a
 * deposit is not a member contribution, and undoing it as one would pull money
 * out of the Reserve without putting the debt back.
 */
export const LINK_MONEY_FLAG = 'linkMoney';

/**
 * A Family admin sends money to its Reserve — any amount, any time, up to the
 * Family wallet. It pays off what the group owes first; whatever is left is a
 * deposit into the Reserve's wallet (counted as a contribution there).
 * No statements or due dates: the link only tracks what is owed.
 */
export const sendToReserveService = async (data: {
    hostGroup: Id;
    linkId: Id;
    amount: number;
    performedBy: Id;
}) => {
    const { hostGroup, linkId, amount, performedBy } = data;

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError('Amount must be a positive number', 400);
    }

    const link = await GroupLink.findOne({ _id: linkId, isDeleted: false });
    if (!link) throw new AppError('Connection not found', 404);
    if (String(link.hostGroupId) !== String(hostGroup)) {
        throw new AppError('This group is not connected to that Reserve', 403);
    }

    const owed = link.outstanding ?? 0;
    const repaid = Math.min(amount, owed);
    const deposited = parseFloat((amount - repaid).toFixed(2));
    // Paying off a debt works on any line that still has one; adding new money
    // needs a live connection.
    if (deposited > 0 && link.status !== 'ACTIVE') {
        throw new AppError(
            owed > 0
                ? `This connection is closed, so only the ${money(owed)} still owed can be sent.`
                : 'This connection is closed, so money can no longer be sent to that Reserve.',
            409
        );
    }

    const source = await Group.findById(link.sourceGroupId).select('name');
    const host = await Group.findById(hostGroup).select('name');

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // Guarded on what was read: if a draw or another send changed the debt
        // in between, this matches nothing and the whole send is retried by the
        // user rather than splitting the money on stale numbers.
        const moved = await GroupLink.findOneAndUpdate(
            { _id: link._id, outstanding: { $gte: toDBAmount(repaid) } },
            { $inc: { outstanding: -repaid, deposited } },
            { new: true, session }
        );
        if (!moved) throw new AppError('What this group owes just changed. Please try again.', 409);

        const debited = await debitGroupBalance(hostGroup, amount, { session });
        if (!debited) throw new AppError('Amount cannot be greater than group balance', 400);

        // The repaid part frees the Reserve's shared limit; the deposit part is
        // new money in, so it counts as a contribution.
        await Group.updateOne(
            { _id: link.sourceGroupId },
            { $inc: { balance: amount, creditUsed: -repaid, totalContribution: deposited } },
            { session }
        );

        const creditCategory = await getOrCreateOtherCreditCategory(link.sourceGroupId as Id, session);
        const meta = { linkId: String(link._id), kind: 'RESERVE_TRANSFER', repaid, deposited, [LINK_MONEY_FLAG]: true };
        const split = repaid > 0 && deposited > 0
            ? ` (${money(repaid)} repaid, ${money(deposited)} deposited)`
            : repaid > 0 ? ' (repayment)' : ' (deposit)';

        await GroupTransaction.create(
            [
                {
                    groupId: hostGroup,
                    amount,
                    action: 'DEBIT',
                    description: `Sent to Reserve ${source?.name ?? ''}${split}`.trim(),
                    referenceId: link.sourceGroupId,
                    referenceModel: 'Group',
                    metadata: meta,
                    performedBy,
                },
                {
                    groupId: link.sourceGroupId,
                    amount,
                    action: 'CREDIT',
                    description: `Received from ${host?.name ?? 'a Family group'}${split}`,
                    referenceId: hostGroup,
                    referenceModel: 'Group',
                    category: creditCategory._id,
                    metadata: meta,
                    performedBy,
                },
            ],
            { session, ordered: true }
        );

        await GroupEvent.create(
            [
                {
                    groupId: hostGroup,
                    performedBy,
                    eventType: 'GROUP_LINK_TRANSFER',
                    referenceId: link.sourceGroupId,
                    referenceModel: 'Group',
                    amount,
                    metadata: { ...meta, direction: 'OUTGOING' },
                },
                {
                    groupId: link.sourceGroupId,
                    performedBy,
                    eventType: 'GROUP_LINK_TRANSFER',
                    referenceId: hostGroup,
                    referenceModel: 'Group',
                    amount,
                    metadata: { ...meta, direction: 'INCOMING' },
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

    await notifyAdmins(link.sourceGroupId as Id, performedBy, 'GROUP_LINK_REPAID', {
        linkId: String(link._id),
        hostGroupId: String(hostGroup),
        amount,
        repaid,
        deposited,
    });

    return GroupLink.findById(link._id);
};

/**
 * Either side can tear down a link — but not while the host still owes on it.
 * Removing it then would strand the debt with no line left to repay it on.
 * Gift-era `contribution` was never owed and does not block this.
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
    if ((link.outstanding ?? 0) > 0) {
        throw new AppError(
            `${money(link.outstanding)} of Reserve credit is still owed on this connection. Repay it before removing the connection.`,
            409
        );
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
    const [incoming, outgoing, self] = await Promise.all([
        // The Reserve's shared limit and usage ride along on each incoming
        // line, so a Family group sees how much credit is actually left.
        GroupLink.find({ hostGroupId: groupId, isDeleted: false })
            .populate('sourceGroupId', 'name displayId status balance creditLimit creditUsed')
            .populate('requestedBy', 'name')
            .sort({ createdAt: -1 }),
        GroupLink.find({ sourceGroupId: groupId, isDeleted: false })
            .populate('hostGroupId', 'name displayId status balance')
            .populate('requestedBy', 'name')
            .sort({ createdAt: -1 }),
        Group.findById(groupId).select('purpose balance creditLimit creditUsed'),
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
        incoming: incoming.map((l) => {
            const src = l.sourceGroupId as any;
            return {
                ...l.toJSON(),
                attributedSpend: spentBySource.get(String(src?._id)) ?? 0,
                // Resolved here with the same rule drawOnCredit enforces, so
                // the number shown is the number a spend will be held to.
                availableCredit: src?._id ? availableCreditOf(src) : 0,
            };
        }),
        outgoing: outgoing.map((l, i) => ({
            ...l.toJSON(),
            hostCanReceive: hostPlans[i].features.linkGroups,
        })),
        // When this group is a Reserve: its fixed limit, what is lent out, its
        // wallet, and what it can still lend (the smaller of the two caps).
        reserveCredit:
            self && groupFeaturesOf(self.purpose).fundOthers
                ? {
                      creditLimit: self.creditLimit ?? 0,
                      creditUsed: self.creditUsed ?? 0,
                      balance: self.balance ?? 0,
                      available: availableCreditOf(self),
                  }
                : null,
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
