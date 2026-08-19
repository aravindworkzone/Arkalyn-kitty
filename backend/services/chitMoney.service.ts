import mongoose from 'mongoose';
import { AppError } from '../helpers/AppError';
import Group from '../models/group.model';
import GroupTransaction from '../models/group_transaction.model';
import GroupEvent from '../models/group_event.model';
import ChitScheme from '../models/chit_scheme.model';
import ChitCycle from '../models/chit_cycle.model';
import ChitDue from '../models/chit_due.model';
import {
    creditGroupBalance,
    debitGroupBalance,
    reverseGroupCredit,
    adjustMemberContribution,
} from '../helpers/balanceOps';
import { getOrCreateChitCreditCategory } from './category.service';
import { createNotification } from './notification.service';

/**
 * The chit's three money paths, kept together so they can be reviewed as a set.
 *
 * Chit money is the GROUP's money. A contribution is an ordinary credit to the
 * group wallet and a payout is an ordinary debit — the same helpers/balanceOps
 * primitives, the same append-only ledger, the same atomic overspend guard that
 * every other money path in this app uses. There is deliberately no parallel
 * chit ledger: a second source of truth for the same rupees is the one thing
 * this codebase has consistently refused to build.
 *
 * All amounts here are RAW RUPEES. The schema setters convert to paise, and
 * Mongoose re-runs them on $inc — so pre-converting would double-scale. Only
 * query FILTERS need toDBAmount, and the only one is inside debitGroupBalance.
 */

type Id = mongoose.Types.ObjectId;

// Marks the ledger row as chit-sourced. removeCreditService refuses to delete a
// credit carrying this, because deleting it would reverse the wallet while the
// due went on claiming it was paid.
export const CHIT_CREDIT_FLAG = 'chitDueId';

const loadDueContext = async (groupId: Id, dueId: Id, session?: mongoose.ClientSession) => {
    const due = await ChitDue.findOne({ _id: dueId, groupId, isDeleted: false }).session(
        session ?? null
    );
    if (!due) throw new AppError('That contribution was not found', 404);

    const cycle = await ChitCycle.findOne({ _id: due.cycleId, isDeleted: false }).session(
        session ?? null
    );
    if (!cycle) throw new AppError('That cycle was not found', 404);

    return { due, cycle };
};

/**
 * Record that a member handed over their contribution for a cycle.
 *
 * Modelled on addContributionService: adjust the member's running total, credit
 * the wallet, write one CREDIT row. The only additions are the cycle's running
 * total and the link back from the due to the ledger row.
 *
 * Works on any cycle, released or not. "Ravi paid his August dues in September"
 * is the most ordinary event in a real chit, and refusing it would leave the
 * ledger permanently unable to balance. A late payment raises that cycle's
 * collectedAmount but never rewrites its shortfallAmount, which records what the
 * recipient actually got on the day.
 */
export const markDuePaidService = async (data: {
    groupId: Id;
    dueId: Id;
    recordedBy: Id;
    paymentType?: string;
}) => {
    const { due, cycle } = await loadDueContext(data.groupId, data.dueId);
    if (due.status === 'PAID') throw new AppError('That contribution is already recorded', 409);

    const amount = due.amount;
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // Conditional claim: a double-submit finds nothing to claim and cannot
        // double-credit the wallet. Same "null means someone beat me to it" idiom
        // as debitGroupBalance.
        const claimed = await ChitDue.findOneAndUpdate(
            { _id: data.dueId, status: 'PENDING', isDeleted: false },
            {
                $set: {
                    status: 'PAID',
                    paidAt: new Date(),
                    recordedBy: data.recordedBy,
                    paymentType: data.paymentType ?? null,
                },
            },
            { new: true, session }
        );
        if (!claimed) throw new AppError('That contribution is already recorded', 409);

        await adjustMemberContribution(data.groupId, due.userId, amount, { session });
        await creditGroupBalance(data.groupId, amount, { session });

        const category = await getOrCreateChitCreditCategory(data.groupId, session);

        const ledger = new GroupTransaction({
            groupId: data.groupId,
            amount,
            action: 'CREDIT',
            description: `Chit contribution — cycle ${due.cycleNumber}`,
            // referenceId is the PAYING MEMBER, matching every other credit source.
            // removeCreditService rolls a credit back by treating referenceId as
            // the contributor, so anything else here would silently corrupt that
            // member's contribution total.
            referenceId: due.userId,
            referenceModel: 'User',
            category: category._id,
            metadata: {
                [CHIT_CREDIT_FLAG]: String(due._id),
                chitCycleId: String(cycle._id),
                cycleNumber: due.cycleNumber,
            },
            performedBy: data.recordedBy,
        });
        await ledger.save({ session });

        await ChitDue.updateOne(
            { _id: due._id },
            { $set: { transactionId: ledger._id } },
            { session }
        );
        // Raw rupees — the schema setter re-runs on $inc.
        await ChitCycle.updateOne(
            { _id: cycle._id },
            { $inc: { collectedAmount: amount } },
            { session }
        );

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        throw new AppError(error.message || 'Could not record that contribution', error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    // Outside the session, after commit: a failed notification must never roll
    // back money that has already been committed.
    if (String(due.userId) !== String(data.recordedBy)) {
        const group = await Group.findById(data.groupId).select('name');
        await createNotification({
            recipient: due.userId,
            actor: data.recordedBy,
            group: data.groupId,
            type: 'CHIT_DUE_RECORDED',
            metadata: { groupName: group?.name, cycleNumber: due.cycleNumber, amount },
        });
    }

    return { dueId: String(due._id), amount };
};

/**
 * Undo a recorded contribution.
 *
 * This exists because marking paid is manual, so marking the wrong member is one
 * misclick — and the ordinary "remove credit" path is deliberately closed to chit
 * rows (it would reverse the wallet while the due went on claiming it was paid).
 * Without this there would be no way back at all.
 *
 * Only while the cycle is still collecting. Once the pot has been handed over,
 * the contributions that filled it are part of a settled account.
 */
export const unmarkDuePaidService = async (data: { groupId: Id; dueId: Id; userId: Id }) => {
    const { due, cycle } = await loadDueContext(data.groupId, data.dueId);
    if (due.status !== 'PAID') throw new AppError('That contribution is not recorded as paid', 409);
    if (cycle.status === 'PAID') {
        throw new AppError(
            'This cycle has already been paid out, so its contributions can no longer be changed.',
            409
        );
    }

    const amount = due.amount;
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const released = await ChitDue.findOneAndUpdate(
            { _id: data.dueId, status: 'PAID', isDeleted: false },
            {
                $set: { status: 'PENDING', paidAt: null, recordedBy: null, paymentType: null, transactionId: null },
            },
            { new: true, session }
        );
        if (!released) throw new AppError('That contribution is not recorded as paid', 409);

        // Pulls both the balance and the lifetime contribution back out, and
        // refuses to drive the balance negative — if the money has already been
        // spent, the correction is blocked rather than silently overdrawing.
        const reversed = await reverseGroupCredit(data.groupId, amount, { session });
        if (!reversed) {
            throw new AppError(
                'That money has already been spent, so the contribution cannot be undone. Record a correction instead.',
                400
            );
        }
        await adjustMemberContribution(data.groupId, due.userId, -amount, {
            session,
            includeLeft: true,
        });

        if (due.transactionId) {
            await GroupTransaction.updateOne(
                { _id: due.transactionId },
                { $set: { isDeleted: true } },
                { session }
            );
        }
        await ChitCycle.updateOne(
            { _id: cycle._id },
            { $inc: { collectedAmount: -amount } },
            { session }
        );

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        throw new AppError(error.message || 'Could not undo that contribution', error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    return { dueId: String(due._id), amount };
};

/**
 * Hand the pot to this cycle's recipient.
 *
 * A short cycle still pays out — one defaulter must not freeze the scheme, and
 * real chits pay the recipient and chase the debtor. The organizer has to
 * acknowledge the shortfall explicitly, and it is recorded on the cycle.
 *
 * The recipient's `contribution` is NOT decremented. Money in is a contribution;
 * the pot going out is a payout. That is exactly the split SettlementService
 * makes, and decrementing here would corrupt the proportional refund the
 * group-close path computes from contribution totals.
 */
export const releasePayoutService = async (data: {
    groupId: Id;
    cycleId: Id;
    userId: Id;
    acknowledgeShortfall?: boolean;
}) => {
    const scheme = await ChitScheme.findOne({
        groupId: data.groupId,
        status: 'ACTIVE',
        isDeleted: false,
    });
    if (!scheme) throw new AppError('This group has no running chit', 404);

    const cycle = await ChitCycle.findOne({
        _id: data.cycleId,
        groupId: data.groupId,
        isDeleted: false,
    });
    if (!cycle) throw new AppError('That cycle was not found', 404);
    if (cycle.status === 'PAID') throw new AppError('That cycle has already been paid out', 409);

    // Strictly in order: paying cycle 4 before cycle 3 would leave cycle 3's
    // recipient behind someone who joined the queue after them.
    const earlierOpen = await ChitCycle.findOne({
        schemeId: scheme._id,
        status: 'COLLECTING',
        cycleNumber: { $lt: cycle.cycleNumber },
        isDeleted: false,
    }).select('cycleNumber');
    if (earlierOpen) {
        throw new AppError(
            `Cycle ${earlierOpen.cycleNumber} has not been paid out yet — cycles are paid in order.`,
            409
        );
    }

    const shortfall = Math.max(0, cycle.expectedAmount - cycle.collectedAmount);
    if (shortfall > 0 && !data.acknowledgeShortfall) {
        throw new AppError(
            `This cycle is ₹${shortfall} short of the full ₹${cycle.expectedAmount}. Confirm to pay out what has been collected.`,
            400
        );
    }

    // What the recipient actually gets: the full pot when it filled, otherwise
    // what was collected. Never more than the group holds — debitGroupBalance
    // enforces that atomically below.
    const payoutAmount = shortfall > 0 ? cycle.collectedAmount : cycle.expectedAmount;
    if (payoutAmount <= 0) {
        throw new AppError('Nothing has been collected for this cycle yet', 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const debited = await debitGroupBalance(data.groupId, payoutAmount, { session });
        if (!debited) {
            throw new AppError(
                'The group wallet does not hold enough to release this payout. Record the outstanding contributions first.',
                400
            );
        }

        const closed = await ChitCycle.findOneAndUpdate(
            { _id: cycle._id, status: 'COLLECTING', isDeleted: false },
            {
                $set: {
                    status: 'PAID',
                    payoutAmount,
                    shortfallAmount: shortfall,
                    paidAt: new Date(),
                    paidBy: data.userId,
                },
            },
            { new: true, session }
        );
        if (!closed) throw new AppError('That cycle has already been paid out', 409);

        await GroupTransaction.create(
            [
                {
                    groupId: data.groupId,
                    amount: payoutAmount,
                    action: 'DEBIT',
                    description: `Chit payout — cycle ${cycle.cycleNumber}`,
                    // The recipient, matching SettlementService's money-out shape.
                    referenceId: cycle.recipientUserId,
                    referenceModel: 'User',
                    metadata: { chitCycleId: String(cycle._id), cycleNumber: cycle.cycleNumber },
                    performedBy: data.userId,
                },
            ],
            { session }
        );

        await GroupEvent.create(
            [
                {
                    groupId: data.groupId,
                    performedBy: data.userId,
                    eventType: 'CHIT_PAYOUT',
                    referenceId: cycle.recipientUserId,
                    referenceModel: 'User',
                    amount: payoutAmount,
                    metadata: {
                        cycleNumber: cycle.cycleNumber,
                        shortfall,
                        note: `Chit cycle ${cycle.cycleNumber} paid out — ₹${payoutAmount}`,
                    },
                },
            ],
            { session }
        );

        // Last cycle done means the scheme is done.
        const remaining = await ChitCycle.countDocuments({
            schemeId: scheme._id,
            status: 'COLLECTING',
            isDeleted: false,
        }).session(session);
        if (remaining === 0) {
            scheme.status = 'COMPLETED';
            scheme.completedAt = new Date();
            await scheme.save({ session });
        }

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        throw new AppError(error.message || 'Could not release the payout', error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    const group = await Group.findById(data.groupId).select('name');
    await createNotification({
        recipient: cycle.recipientUserId,
        actor: data.userId,
        group: data.groupId,
        type: 'CHIT_PAYOUT_RELEASED',
        metadata: {
            groupName: group?.name,
            cycleNumber: cycle.cycleNumber,
            amount: payoutAmount,
            shortfall,
        },
    });

    return { cycleNumber: cycle.cycleNumber, payoutAmount, shortfall };
};
