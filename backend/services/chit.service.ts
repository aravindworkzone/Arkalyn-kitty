import mongoose from 'mongoose';
import { AppError } from '../helpers/AppError';
import GroupMember from '../models/group_member.model';
import GroupEvent from '../models/group_event.model';
import ChitScheme, { MAX_CHIT_PARTICIPANTS, type IChitScheme } from '../models/chit_scheme.model';
import ChitCycle from '../models/chit_cycle.model';
import ChitDue, { type ChitDueState } from '../models/chit_due.model';
import { getGroupPlan } from '../helpers/planLimits';

/**
 * Chit fund: the scheme lifecycle and the one resolved read.
 *
 * The money paths (recording a contribution, undoing it, releasing a payout)
 * live in chitMoney.service.ts — they share nothing with this file but the
 * models, and keeping the wallet writes in one place makes them reviewable as a
 * set.
 *
 * A chit here is the simple rotating kind: fixed contribution per member per
 * cycle, one member per cycle takes the pot, in an order fixed at activation.
 * No auction, no bidding, no commission, no dividend. Everyone pays every cycle
 * including that cycle's recipient, so the pot is constant and over the full
 * term each member pays in exactly what they take out.
 */

type Id = mongoose.Types.ObjectId;

// ─── Schedule ────────────────────────────────────────────────────────────────

/**
 * Parses a "YYYY-MM-DD" calendar day into LOCAL midnight.
 *
 * Never `new Date(str)` — that parses a bare date as UTC midnight, so anyone west
 * of Greenwich gets the previous day. Same rule helpers/date.ts states on the
 * client.
 */
export const parseISODay = (iso: string): Date => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) throw new AppError('Invalid date', 400);
    const date = new Date(y, m - 1, d, 0, 0, 0, 0);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
        throw new AppError('Invalid date', 400);
    }
    return date;
};

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

// Cycle n opens `interval × (n-1)` days after the start, and its contributions
// are on time for `dueDays` after that.
const cycleDueDate = (startDate: Date, intervalDays: number, dueDays: number, cycleNumber: number) =>
    addDays(startDate, intervalDays * (cycleNumber - 1) + dueDays);

// ─── Due state ───────────────────────────────────────────────────────────────

/**
 * THE resolution of a due's state. Every surface reads through this, so the
 * member view, the organizer roster and the history log cannot disagree.
 *
 * Missed is derived rather than stored: flipping a stored flag would need a
 * scheduled job, and this codebase has deliberately refused one for the identical
 * problem (lazy plan expiry, helpers/planLimits.ts).
 *
 * The second clause matters — an unpaid due in a cycle that has already paid out
 * is missed even if its date has not passed, because the money it was meant for
 * has already gone. It does not stop the member paying later; it only stops the
 * UI calling it "pending" when the pot it belonged to is closed.
 */
export const dueState = (
    due: { status: string; dueDate: Date },
    cycleStatus: string,
    now: Date
): ChitDueState => {
    if (due.status === 'PAID') return 'PAID';
    if (now > due.dueDate || cycleStatus === 'PAID') return 'MISSED';
    return 'PENDING';
};

// ─── Lookups ─────────────────────────────────────────────────────────────────

// The group's scheme that is still open for business, or null.
export const findOpenScheme = (groupId: Id, session?: mongoose.ClientSession) =>
    ChitScheme.findOne({ groupId, status: { $in: ['DRAFT', 'ACTIVE'] }, isDeleted: false }).session(
        session ?? null
    );

const requireOpenScheme = async (groupId: Id, session?: mongoose.ClientSession) => {
    const scheme = await findOpenScheme(groupId, session);
    if (!scheme) throw new AppError('This group has no chit set up', 404);
    return scheme;
};

const assertDraft = (scheme: IChitScheme) => {
    if (scheme.status !== 'DRAFT') {
        throw new AppError(
            'This chit has already started. Its amount, members and order are fixed — only the dates can still be changed.',
            409
        );
    }
};

// ─── Scheme lifecycle ────────────────────────────────────────────────────────

export const createChitSchemeService = async (data: {
    groupId: Id;
    createdBy: Id;
    callerRole: string;
    amountPerMember: number;
    startDate: string;
    cycleIntervalDays: number;
    dueDays: number;
    organizerUserId?: string;
}) => {
    const existing = await findOpenScheme(data.groupId);
    if (existing) {
        throw new AppError(
            existing.status === 'DRAFT'
                ? 'This group already has a chit being set up'
                : 'This group is already running a chit',
            409
        );
    }

    // Naming someone else as organizer hands them the till, so only the owner may
    // do it. Anyone else setting up a chit is the organizer of it.
    let organizerUserId: Id = data.createdBy;
    if (data.organizerUserId && String(data.organizerUserId) !== String(data.createdBy)) {
        if (data.callerRole !== 'SUPER_ADMIN') {
            throw new AppError('Only the group owner can name someone else as organiser', 403);
        }
        organizerUserId = new mongoose.Types.ObjectId(data.organizerUserId);
    }
    await assertActiveMember(data.groupId, organizerUserId, 'The organiser must be a member of this group');

    const scheme = await ChitScheme.create({
        groupId: data.groupId,
        status: 'DRAFT',
        amountPerMember: data.amountPerMember,
        // A draft has no members yet, so there is nothing to run. Set to the
        // minimum the schema allows and corrected on every participant update.
        totalCycles: 1,
        startDate: parseISODay(data.startDate),
        cycleIntervalDays: data.cycleIntervalDays,
        dueDays: data.dueDays,
        organizerUserId,
        participants: [],
        createdBy: data.createdBy,
    });

    await writeChitEvent(data.groupId, data.createdBy, 'CHIT_UPDATED', scheme._id as Id, {
        action: 'CREATED',
        note: 'Chit set up started',
    });

    return scheme;
};

const assertActiveMember = async (groupId: Id, userId: Id, message: string) => {
    const member = await GroupMember.findOne({ groupId, userId, isDeleted: false }).select('_id');
    if (!member) throw new AppError(message, 400);
};

export const updateChitSchemeService = async (data: {
    groupId: Id;
    userId: Id;
    amountPerMember?: number;
    startDate?: string;
    cycleIntervalDays?: number;
    dueDays?: number;
    participants?: { userId: string; position: number }[];
}) => {
    const scheme = await requireOpenScheme(data.groupId);
    assertDraft(scheme);

    if (data.amountPerMember !== undefined) scheme.amountPerMember = data.amountPerMember;
    if (data.startDate !== undefined) scheme.startDate = parseISODay(data.startDate);
    if (data.cycleIntervalDays !== undefined) scheme.cycleIntervalDays = data.cycleIntervalDays;
    if (data.dueDays !== undefined) scheme.dueDays = data.dueDays;

    if (data.participants) {
        const participants = await validateParticipants(data.groupId, data.participants);
        scheme.participants = participants;
        // One turn each: the number of cycles IS the number of members. Derived
        // rather than asked for, so the two can never disagree.
        scheme.totalCycles = participants.length;
    }

    await scheme.save();
    await writeChitEvent(data.groupId, data.userId, 'CHIT_UPDATED', scheme._id as Id, {
        action: 'UPDATED',
        note: 'Chit setup updated',
    });
    return scheme;
};

/**
 * Turn order validation. The positions must be a contiguous 1..N permutation —
 * no gaps, no duplicates — because position N is also cycle N, and a gap would
 * leave a cycle with no recipient.
 */
const validateParticipants = async (
    groupId: Id,
    input: { userId: string; position: number }[]
) => {
    if (input.length < 2) throw new AppError('A chit needs at least two members', 400);
    if (input.length > MAX_CHIT_PARTICIPANTS) {
        throw new AppError(`A chit can have at most ${MAX_CHIT_PARTICIPANTS} members`, 400);
    }

    const userIds = input.map((p) => String(p.userId));
    if (new Set(userIds).size !== userIds.length) {
        throw new AppError('The same member appears twice in the order', 400);
    }

    const positions = input.map((p) => p.position).sort((a, b) => a - b);
    const contiguous = positions.every((pos, i) => pos === i + 1);
    if (!contiguous) {
        throw new AppError('Turn positions must run 1 to ' + input.length + ' with no gaps', 400);
    }

    const members = await GroupMember.find({
        groupId,
        userId: { $in: userIds },
        isDeleted: false,
    }).select('userId');
    if (members.length !== userIds.length) {
        throw new AppError('Everyone in the chit must be an active member of the group', 400);
    }

    return input.map((p) => ({
        userId: new mongoose.Types.ObjectId(p.userId),
        position: p.position,
    }));
};

/**
 * Activation: freeze the order and materialise the whole schedule.
 *
 * Every cycle AND every due is created here, in one transaction — N² rows, which
 * MAX_CHIT_PARTICIPANTS bounds at 2,500. Doing it up front means there is no
 * per-cycle "open" step for the organizer to remember, members can pay ahead, and
 * "my history" is a plain indexed query rather than something reconstructed.
 */
export const activateChitSchemeService = async (data: { groupId: Id; userId: Id }) => {
    const scheme = await requireOpenScheme(data.groupId);
    assertDraft(scheme);

    if (scheme.participants.length < 2) {
        throw new AppError('Add the members and their turn order before starting the chit', 400);
    }
    if (scheme.amountPerMember <= 0) {
        throw new AppError('Set the amount each member pays before starting the chit', 400);
    }

    // Re-check every participant is still in the group — the draft may be days old.
    const activeMembers = await GroupMember.find({
        groupId: data.groupId,
        userId: { $in: scheme.participants.map((p) => p.userId) },
        isDeleted: false,
    }).select('userId');
    if (activeMembers.length !== scheme.participants.length) {
        throw new AppError(
            'Someone in the chit has left the group. Update the members before starting it.',
            400
        );
    }

    // The plan's member cap is the honest billing lever here: a Free group can run
    // a 5-person chit, a real 20-person one needs Pro. Checked at activation as
    // well as at setup, because a plan can lapse in between.
    //
    // Not assertWithinLimit — that compares a COUNT against a limit with >=, and
    // this is a requested SIZE compared with >.
    const plan = await getGroupPlan(data.groupId);
    const cap = plan.limits.maxMembersPerGroup;
    if (cap !== null && scheme.participants.length > cap) {
        throw new AppError(
            `A ${scheme.participants.length}-member chit needs a plan allowing at least that many members. This group's ${plan.config.name} plan allows ${cap}.`,
            402
        );
    }

    const ordered = [...scheme.participants].sort((a, b) => a.position - b.position);
    const potPerCycle = scheme.amountPerMember * ordered.length;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const cycleDocs = ordered.map((participant) => ({
            schemeId: scheme._id,
            groupId: data.groupId,
            cycleNumber: participant.position,
            status: 'COLLECTING' as const,
            recipientUserId: participant.userId,
            expectedAmount: potPerCycle,
            dueDate: cycleDueDate(
                scheme.startDate,
                scheme.cycleIntervalDays,
                scheme.dueDays,
                participant.position
            ),
        }));
        const cycles = await ChitCycle.insertMany(cycleDocs, { session });

        // One due per member per cycle — including the cycle's own recipient, who
        // pays like everyone else.
        //
        // Built with nested loops rather than flatMap: this project targets ES2017
        // (see tsconfig `lib`), where Array.prototype.flatMap does not exist.
        const dueDocs: Record<string, unknown>[] = [];
        for (const cycle of cycles) {
            for (const participant of ordered) {
                dueDocs.push({
                    schemeId: scheme._id,
                    cycleId: cycle._id,
                    groupId: data.groupId,
                    cycleNumber: cycle.cycleNumber,
                    userId: participant.userId,
                    amount: scheme.amountPerMember,
                    status: 'PENDING' as const,
                    dueDate: cycle.dueDate,
                });
            }
        }
        await ChitDue.insertMany(dueDocs, { session });

        scheme.status = 'ACTIVE';
        scheme.activatedAt = new Date();
        await scheme.save({ session });

        await GroupEvent.create(
            [
                {
                    groupId: data.groupId,
                    performedBy: data.userId,
                    eventType: 'CHIT_UPDATED',
                    referenceId: data.groupId,
                    referenceModel: 'Group',
                    metadata: {
                        action: 'ACTIVATED',
                        cycles: ordered.length,
                        amountPerMember: scheme.amountPerMember,
                        note: `Chit started — ${ordered.length} cycles of ₹${potPerCycle}`,
                    },
                },
            ],
            { session }
        );

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        if (error.code === 11000) throw new AppError('This chit has already been started', 409);
        throw new AppError(error.message || 'Could not start the chit', error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    return scheme;
};

/**
 * Dates only, on a running chit.
 *
 * Re-dates every cycle not yet paid out, and their dues with them. Paid cycles
 * keep the dates they actually ran on — those are history. Because "missed" is
 * derived from the due date, pushing the schedule back correctly un-misses
 * members who were only late against the old calendar, which is exactly what an
 * organizer means by "we're running a month behind".
 */
export const rescheduleChitService = async (data: {
    groupId: Id;
    userId: Id;
    startDate?: string;
    cycleIntervalDays?: number;
    dueDays?: number;
}) => {
    const scheme = await requireOpenScheme(data.groupId);
    if (scheme.status !== 'ACTIVE') {
        throw new AppError('This chit has not started yet — edit the setup instead', 409);
    }

    if (data.startDate !== undefined) scheme.startDate = parseISODay(data.startDate);
    if (data.cycleIntervalDays !== undefined) scheme.cycleIntervalDays = data.cycleIntervalDays;
    if (data.dueDays !== undefined) scheme.dueDays = data.dueDays;

    const openCycles = await ChitCycle.find({
        schemeId: scheme._id,
        status: 'COLLECTING',
        isDeleted: false,
    }).select('_id cycleNumber');

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        for (const cycle of openCycles) {
            const dueDate = cycleDueDate(
                scheme.startDate,
                scheme.cycleIntervalDays,
                scheme.dueDays,
                cycle.cycleNumber
            );
            await ChitCycle.updateOne({ _id: cycle._id }, { $set: { dueDate } }, { session });
            await ChitDue.updateMany(
                { cycleId: cycle._id, isDeleted: false },
                { $set: { dueDate } },
                { session }
            );
        }

        await scheme.save({ session });

        await GroupEvent.create(
            [
                {
                    groupId: data.groupId,
                    performedBy: data.userId,
                    eventType: 'CHIT_UPDATED',
                    referenceId: data.groupId,
                    referenceModel: 'Group',
                    metadata: {
                        action: 'RESCHEDULED',
                        cyclesMoved: openCycles.length,
                        note: `Chit schedule updated — ${openCycles.length} upcoming cycles re-dated`,
                    },
                },
            ],
            { session }
        );

        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();
        throw new AppError(error.message || 'Could not reschedule the chit', error.statusCode || 500);
    } finally {
        await session.endSession();
    }

    return scheme;
};

/**
 * Cancel. Money already collected stays where it is — in the group wallet, as
 * ordinary contributions credited to the members who paid them. There is no
 * unwinding: those contributions were real, and the group can settle up through
 * the ordinary settlement path if it is closing down.
 */
export const cancelChitSchemeService = async (data: { groupId: Id; userId: Id; reason: string }) => {
    const scheme = await requireOpenScheme(data.groupId);

    scheme.status = 'CANCELLED';
    scheme.cancelledAt = new Date();
    scheme.cancelledReason = data.reason;
    await scheme.save();

    await writeChitEvent(data.groupId, data.userId, 'CHIT_UPDATED', scheme._id as Id, {
        action: 'CANCELLED',
        reason: data.reason,
        note: `Chit cancelled: ${data.reason}`,
    });

    return scheme;
};

/**
 * Hand the organizer role to someone else. SUPER_ADMIN only — it is the key to
 * the till, and without this a group whose organizer goes quiet has no way
 * forward but cancelling.
 */
export const reassignOrganizerService = async (data: {
    groupId: Id;
    userId: Id;
    organizerUserId: string;
}) => {
    const scheme = await requireOpenScheme(data.groupId);
    const next = new mongoose.Types.ObjectId(data.organizerUserId);
    await assertActiveMember(data.groupId, next, 'The organiser must be a member of this group');

    scheme.organizerUserId = next;
    await scheme.save();

    await writeChitEvent(data.groupId, data.userId, 'CHIT_UPDATED', scheme._id as Id, {
        action: 'ORGANIZER_CHANGED',
        organizerUserId: String(next),
        note: 'Chit organiser changed',
    });

    return scheme;
};

const writeChitEvent = async (
    groupId: Id,
    performedBy: Id,
    eventType: 'CHIT_UPDATED' | 'CHIT_PAYOUT',
    _referenceId: Id,
    metadata: Record<string, unknown>
) => {
    await GroupEvent.create({
        groupId,
        performedBy,
        eventType,
        // The group is the reference, not the scheme: referenceModel is a closed
        // enum of populatable models and adding ChitScheme to it buys nothing —
        // the scheme id is in metadata for anyone who wants it.
        referenceId: groupId,
        referenceModel: 'Group',
        metadata,
    });
};

// ─── The read ────────────────────────────────────────────────────────────────

const nameOf = (user: any): string => user?.name ?? 'Removed member';

/**
 * Everything both views need, in one request, with every status already resolved.
 *
 * The member/organizer split is enforced by what this returns, not by what the UI
 * chooses to render: `memberDues` is absent — not empty — unless the caller may
 * manage the chit, and `myDue`/`myPayout`/`history` are built from the caller's
 * own id so they structurally cannot carry anyone else's payments.
 *
 * Whose turn it is, and who has already been paid, IS public to every member.
 * That transparency is the point of the feature.
 */
export const getChitBoardService = async (data: {
    groupId: Id;
    userId: Id;
    role: string;
    cycleNumber?: number;
}) => {
    const now = new Date();

    const scheme = await ChitScheme.findOne({ groupId: data.groupId, isDeleted: false })
        .sort({ createdAt: -1 })
        .populate('organizerUserId', 'name email');

    if (!scheme) {
        return { scheme: null, cycle: null, myDue: null, myPayout: null, turns: [], asOf: now };
    }

    // TWO different questions, deliberately not one flag.
    //
    // canManage is WRITE authority: who may mark a contribution paid and release
    // the pot. It stays organiser-or-SUPER_ADMIN and is never widened to ADMIN,
    // because defaultJoinRole makes every member of a Free group an ADMIN — a role
    // check there would let anyone pay themselves the pot.
    //
    // canViewAll is READ breadth: who sees the group's collection figures and the
    // per-member roster, rather than only their own dues. A plain MEMBER gets the
    // narrow view — what they owe, when, who has been paid and who is next.
    //
    // Widening the read to ADMIN is safe in a way widening the write is not: the
    // worst case on a Free group is that everyone sees figures about a chit they
    // are all in. Note the consequence though — a Free group has no MEMBER role at
    // all, so the narrow view only ever appears on a plan that has memberRole.
    const canManage =
        String((scheme.organizerUserId as any)?._id ?? scheme.organizerUserId) === String(data.userId) ||
        data.role === 'SUPER_ADMIN';
    const canViewAll = canManage || data.role === 'ADMIN';

    const cycles = await ChitCycle.find({ schemeId: scheme._id, isDeleted: false })
        .sort({ cycleNumber: 1 })
        .populate('recipientUserId', 'name email');

    // The current cycle is the lowest-numbered one still collecting. Derived, so
    // nothing has to be advanced when a payout lands.
    const currentCycle = cycles.find((c) => c.status === 'COLLECTING') ?? null;
    const selected =
        data.cycleNumber !== undefined
            ? cycles.find((c) => c.cycleNumber === data.cycleNumber) ?? null
            : currentCycle;

    const memberMap = new Map<string, string>();
    for (const cycle of cycles) {
        memberMap.set(String((cycle.recipientUserId as any)?._id), nameOf(cycle.recipientUserId));
    }

    const paidCycleNumbers = new Set(cycles.filter((c) => c.status === 'PAID').map((c) => c.cycleNumber));

    // Public: the fixed order, who is next, who has already been paid. Carries no
    // payment fields at all, so there is nothing here to leak.
    const turns = [...scheme.participants]
        .sort((a, b) => a.position - b.position)
        .map((p) => {
            const cycle = cycles.find((c) => c.cycleNumber === p.position);
            const received = cycle?.status === 'PAID';
            return {
                position: p.position,
                cycleNumber: p.position,
                userId: String(p.userId),
                name: memberMap.get(String(p.userId)) ?? 'Member',
                isMe: String(p.userId) === String(data.userId),
                payoutState: received
                    ? ('RECEIVED' as const)
                    : currentCycle?.cycleNumber === p.position
                      ? ('CURRENT' as const)
                      : ('UPCOMING' as const),
                expectedOn: cycle?.dueDate ?? null,
                receivedOn: cycle?.paidAt ?? null,
                receivedAmount: received ? cycle!.payoutAmount : null,
            };
        });

    // The caller's own dues, and only ever their own.
    const myDues = await ChitDue.find({
        schemeId: scheme._id,
        userId: data.userId,
        isDeleted: false,
    }).sort({ cycleNumber: 1 });

    const cycleStatusByNumber = new Map(cycles.map((c) => [c.cycleNumber, c.status]));
    const myHistory = myDues.map((due) => ({
        cycleNumber: due.cycleNumber,
        amount: due.amount,
        dueDate: due.dueDate,
        paidAt: due.paidAt,
        state: dueState(due, cycleStatusByNumber.get(due.cycleNumber) ?? 'COLLECTING', now),
    }));

    const myDueForSelected = selected
        ? myDues.find((d) => d.cycleNumber === selected.cycleNumber) ?? null
        : null;

    const myTurn = turns.find((t) => t.isMe) ?? null;

    // Unpaid dues from cycles that have already paid out — money still owed to a
    // pot that has already been handed over.
    const arrears = myHistory.filter((h) => h.state === 'MISSED' && paidCycleNumbers.has(h.cycleNumber));

    const board: Record<string, unknown> = {
        scheme: {
            schemeId: String(scheme._id),
            status: scheme.status,
            amountPerMember: scheme.amountPerMember,
            potPerCycle: scheme.amountPerMember * scheme.participants.length,
            totalCycles: scheme.totalCycles,
            cyclesPaid: paidCycleNumbers.size,
            startDate: scheme.startDate,
            cycleIntervalDays: scheme.cycleIntervalDays,
            dueDays: scheme.dueDays,
            participantCount: scheme.participants.length,
            organizer: {
                userId: String((scheme.organizerUserId as any)?._id ?? scheme.organizerUserId),
                name: nameOf(scheme.organizerUserId),
                isMe:
                    String((scheme.organizerUserId as any)?._id ?? scheme.organizerUserId) ===
                    String(data.userId),
            },
            canManage,
            canViewAll,
        },
        cycle: selected
            ? {
                  cycleId: String(selected._id),
                  cycleNumber: selected.cycleNumber,
                  status: selected.status,
                  recipient: {
                      userId: String((selected.recipientUserId as any)?._id),
                      name: nameOf(selected.recipientUserId),
                      isMe: String((selected.recipientUserId as any)?._id) === String(data.userId),
                  },
                  // The pot, and what the recipient actually got. Both stay visible
                  // to everyone: the pot is the term each member agreed to, and who
                  // received how much is the whole point of watching the rotation.
                  expectedAmount: selected.expectedAmount,
                  payoutAmount: selected.payoutAmount,
                  // How collection is GOING — the organiser's business, not every
                  // member's. Spread in rather than set to null, so a member's
                  // payload has no key at all and the client cannot render a
                  // half-filled meter off a zero it mistook for a real figure.
                  ...(canViewAll
                      ? {
                            collectedAmount: selected.collectedAmount,
                            shortfallAmount: selected.shortfallAmount,
                            collectedPct:
                                selected.expectedAmount > 0
                                    ? Math.min(
                                          100,
                                          Math.round(
                                              (selected.collectedAmount / selected.expectedAmount) * 100
                                          )
                                      )
                                    : 0,
                        }
                      : {}),
                  dueDate: selected.dueDate,
                  paidAt: selected.paidAt,
                  overdue: selected.status === 'COLLECTING' && now > selected.dueDate,
                  isCurrent: selected.cycleNumber === currentCycle?.cycleNumber,
              }
            : null,
        myDue: myDueForSelected
            ? {
                  dueId: String(myDueForSelected._id),
                  amount: myDueForSelected.amount,
                  dueDate: myDueForSelected.dueDate,
                  paidAt: myDueForSelected.paidAt,
                  state: dueState(myDueForSelected, selected?.status ?? 'COLLECTING', now),
              }
            : null,
        myPayout: myTurn
            ? {
                  position: myTurn.position,
                  cycleNumber: myTurn.cycleNumber,
                  state: myTurn.payoutState,
                  expectedOn: myTurn.expectedOn,
                  expectedAmount: scheme.amountPerMember * scheme.participants.length,
                  receivedOn: myTurn.receivedOn,
                  receivedAmount: myTurn.receivedAmount,
              }
            : null,
        turns,
        myHistory,
        myArrears: arrears.length
            ? { count: arrears.length, amount: arrears.reduce((sum, a) => sum + a.amount, 0) }
            : null,
        asOf: now,
    };

    // The per-member roster. Gated on the WIDE READ, not on canManage — an admin
    // may see who has paid without being the one who records it, and the client
    // renders the rows read-only unless canManage is also true.
    //
    // Absent rather than empty: an empty array renders as "nobody has paid", which
    // is a different and wrong statement.
    if (canViewAll && selected) {
        const dues = await ChitDue.find({ cycleId: selected._id, isDeleted: false }).populate(
            'userId',
            'name email'
        );
        const positionOf = new Map(scheme.participants.map((p) => [String(p.userId), p.position]));
        const rows = dues
            .map((due) => ({
                dueId: String(due._id),
                userId: String((due.userId as any)?._id),
                name: nameOf(due.userId),
                isMe: String((due.userId as any)?._id) === String(data.userId),
                position: positionOf.get(String((due.userId as any)?._id)) ?? 0,
                amount: due.amount,
                paidAt: due.paidAt,
                paymentType: due.paymentType,
                state: dueState(due, selected.status, now),
            }))
            // By turn position, always — never by state. Re-sorting as rows are
            // marked paid would make them jump under the organizer's finger.
            .sort((a, b) => a.position - b.position);

        board.memberDues = rows;
        board.tally = {
            paid: rows.filter((r) => r.state === 'PAID').length,
            pending: rows.filter((r) => r.state === 'PENDING').length,
            missed: rows.filter((r) => r.state === 'MISSED').length,
            total: rows.length,
        };
    }

    return board;
};

/**
 * The cycle history log, paginated. Serves both views: the row is
 * "Cycle 1 → Meera got ₹25,000 on 5 Jan" for everyone, plus the caller's own
 * paid/missed marker — never anyone else's.
 */
export const getChitHistoryService = async (data: {
    groupId: Id;
    userId: Id;
    role: string;
    page: number;
    limit: number;
}) => {
    const now = new Date();
    const scheme = await ChitScheme.findOne({ groupId: data.groupId, isDeleted: false }).sort({
        createdAt: -1,
    });
    if (!scheme) return { items: [], total: 0 };

    // Same split as the board: everyone sees who received how much and when, only
    // the wider read sees how collection went. Resolved independently rather than
    // passed in, so the two endpoints cannot be given different answers.
    const canViewAll =
        String(scheme.organizerUserId) === String(data.userId) ||
        data.role === 'SUPER_ADMIN' ||
        data.role === 'ADMIN';

    const filter = { schemeId: scheme._id, isDeleted: false };
    const [cycles, total] = await Promise.all([
        ChitCycle.find(filter)
            .sort({ cycleNumber: -1 })
            .skip((data.page - 1) * data.limit)
            .limit(data.limit)
            .populate('recipientUserId', 'name email'),
        ChitCycle.countDocuments(filter),
    ]);

    const myDues = await ChitDue.find({
        schemeId: scheme._id,
        userId: data.userId,
        cycleNumber: { $in: cycles.map((c) => c.cycleNumber) },
        isDeleted: false,
    });
    const myDueByCycle = new Map(myDues.map((d) => [d.cycleNumber, d]));

    const items = cycles.map((cycle) => {
        const mine = myDueByCycle.get(cycle.cycleNumber);
        return {
            cycleId: String(cycle._id),
            cycleNumber: cycle.cycleNumber,
            status: cycle.status,
            recipient: {
                userId: String((cycle.recipientUserId as any)?._id),
                name: nameOf(cycle.recipientUserId),
                isMe: String((cycle.recipientUserId as any)?._id) === String(data.userId),
            },
            expectedAmount: cycle.expectedAmount,
            payoutAmount: cycle.payoutAmount,
            ...(canViewAll
                ? {
                      collectedAmount: cycle.collectedAmount,
                      shortfallAmount: cycle.shortfallAmount,
                  }
                : {}),
            dueDate: cycle.dueDate,
            paidAt: cycle.paidAt,
            myDue: mine
                ? {
                      amount: mine.amount,
                      paidAt: mine.paidAt,
                      state: dueState(mine, cycle.status, now),
                  }
                : null,
        };
    });

    return { items, total };
};
