import mongoose from 'mongoose';
import { env } from '../config/env';
import User from '../models/user.model';
import Group, { type GroupPurpose } from '../models/group.model';
import type { Plan } from '../config/constants';
import GroupMember from '../models/group_member.model';
import GroupInvite from '../models/group_invite.model';
import GroupLink from '../models/group_link.model';
import GroupJoinLink, { generateJoinToken } from '../models/group_join_link.model';
import GroupTransaction from '../models/group_transaction.model';
import GroupEvent from '../models/group_event.model';
import Category from '../models/category.model';
import Expense, { PAYMENT_TYPES } from '../models/expense.model';
import { PURPOSE_DEFAULT_CATEGORIES } from '../config/purposeCategories';
import { groupFeaturesOf } from '../helpers/groupTypes';
import ChitScheme from '../models/chit_scheme.model';
import ChitCycle from '../models/chit_cycle.model';
import ChitDue, { type IChitDue } from '../models/chit_due.model';
import { getOrCreateChitCreditCategory } from '../services/category.service';
import { CHIT_CREDIT_FLAG } from '../services/chitMoney.service';
import { creditGroupBalance, debitGroupBalance, adjustMemberContribution } from '../helpers/balanceOps';

/**
 * Seeds a month of realistic activity for the four test accounts.
 *
 *   npm run seed:data
 *
 * Shape: one group per test user (so "200 expenses each" reads the same whether
 * you count per user or per group), every test user a member of every group,
 * ~200 expenses per group spread over the last 30 days.
 *
 * Two invariants this script exists to respect, both enforced elsewhere in the
 * app and easy to violate when writing documents directly:
 *
 *  1. An expense can never exceed the wallet. So spend is generated FIRST, then
 *     contributions are sized to cover it with headroom — never the other way
 *     round, which would need retry logic and could still strand a group.
 *  2. Every balance movement has a ledger row. Each expense gets a DEBIT and
 *     each contribution a CREDIT, so `balance == totalContribution - spend`
 *     holds and the transaction log reconciles. The script asserts this at the
 *     end rather than trusting it.
 *
 * Amounts are whole rupees throughout. Splits are distributed with the
 * remainder pushed onto the first member so they sum EXACTLY to the total —
 * the Expense schema rejects a split that doesn't.
 *
 * Idempotent: seeded groups are deleted first via Group.findOneAndDelete, which
 * fires the model's own cascade rather than duplicating cleanup here.
 */

// test1-4 carry every group below; test5-10 exist only to give the chit a
// realistic size. Order matters: GroupSpec indexes into this list.
const TEST_EMAILS = [
    'test1@gmail.com', 'test2@gmail.com', 'test3@gmail.com', 'test4@gmail.com', 'test5@gmail.com',
    'test6@gmail.com', 'test7@gmail.com', 'test8@gmail.com', 'test9@gmail.com', 'test10@gmail.com',
];

const EXPENSES_PER_GROUP = 200;
const DAYS = 30;
/** Contributions cover spend with this much headroom, so the wallet stays positive. */
const FUNDING_RATIO = 1.4;

interface GroupSpec {
    name: string;
    purpose: GroupPurpose;
    /** Index into the seeded users — this group's SUPER_ADMIN. */
    owner: number;
    /** Indices of the other members, in role order: ADMIN first, then MEMBERs. */
    others: number[];
    /**
     * The tier to put the group on. Omitted means FREE.
     *
     * Not decoration: FREE caps a group at 5 members, so a 10-person chit on FREE
     * would be a group the app itself considers over its limit — activation
     * checks `participants.length` against `maxMembersPerGroup` and would refuse
     * to start it. PRO also turns on `memberRole`, which is what lets the seeded
     * MEMBER roles mean anything: without it defaultJoinRole makes everyone an
     * ADMIN and the chit's member view is unreachable.
     */
    plan?: Plan;
}

const GROUPS: GroupSpec[] = [
    { name: 'Seed · Household', purpose: 'ROOMMATES', owner: 0, others: [1, 2, 3] },
    { name: 'Seed · Weekend Trips', purpose: 'FRIENDS', owner: 1, others: [0, 2, 3] },
    // Only three members, so test4 can sit in the join-requests queue below.
    { name: 'Seed · Family Budget', purpose: 'FAMILY', owner: 2, others: [0, 1] },
    { name: 'Seed · Team Offsite', purpose: 'TEAM', owner: 3, others: [0, 1, 2] },
    // A Chit runs its rotation and nothing else; like the Reserve below it records
    // no expenses, so it gets contributions and a wallet but no spend.
    //
    // Ten members, which is what a real chit looks like and what makes the board
    // worth looking at — a 4-person rotation is over in four cycles and never
    // reaches the mid-term states. Ten needs PRO; see GroupSpec.plan.
    {
        name: 'Seed · Monthly Chit',
        purpose: 'CHIT',
        owner: 0,
        others: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        plan: 'PRO',
    },
    // A Reserve holds money and bankrolls other groups; it records no expenses,
    // so it gets contributions and a wallet but no spend.
    { name: 'Seed · Reserve Pool', purpose: 'RESERVE', owner: 1, others: [0, 2] },
];

const CREDIT_CATEGORIES = [
    { name: 'Other', color: '#64748b' },
    { name: 'Salary', color: '#10b981' },
    { name: 'Top-up', color: '#6366f1' },
];

const TITLES = [
    'Groceries run', 'Electricity bill', 'Water bill', 'Internet', 'Cab fare', 'Team lunch',
    'Coffee', 'Dinner out', 'Movie tickets', 'Fuel', 'Medicines', 'Stationery',
    'Snacks', 'Laundry', 'Gas cylinder', 'Repairs', 'Subscription', 'Parking',
    'Train tickets', 'Gift', 'Cleaning supplies', 'Fruit & veg', 'Breakfast', 'Taxi',
];

// Deterministic PRNG (mulberry32) so re-running produces the same data — a seed
// you can't reproduce is a poor base for comparing before/after behaviour.
const makeRng = (seed: number) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rng = makeRng(20260815);

const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;
const intBetween = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** Whole-rupee split that sums exactly to `amount`; remainder goes to the first. */
const splitEvenly = (amount: number, n: number): number[] => {
    const base = Math.floor(amount / n);
    const parts = Array(n).fill(base);
    parts[0] += amount - base * n;
    return parts;
};

const seed = async () => {
    if (!env.MONGO_URI) throw new Error('MONGO_URI is not set — check backend/.env');
    await mongoose.connect(env.MONGO_URI);
    console.log('db:', mongoose.connection.name);

    const users = await User.find({ email: { $in: TEST_EMAILS } }).select('_id name email');
    if (users.length !== TEST_EMAILS.length) {
        throw new Error(
            `expected ${TEST_EMAILS.length} test users, found ${users.length}. Run "npm run seed:users" first.`
        );
    }
    // Keep them in the TEST_EMAILS order so GroupSpec indices are stable.
    const U = TEST_EMAILS.map((e) => users.find((u) => u.email === e)!);

    // ── Clean previous run ────────────────────────────────────────────────────
    // findOneAndDelete fires the cascade on the Group model, which clears
    // expenses, categories, members, join links and funding links for us.
    const stale = await Group.find({ name: { $in: GROUPS.map((g) => g.name) } }).select('_id');
    for (const g of stale) await Group.findOneAndDelete({ _id: g._id });
    if (stale.length) console.log(`removed ${stale.length} previously seeded group(s)`);
    await GroupInvite.deleteMany({ groupId: { $in: stale.map((g) => g._id) } });

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const created: { group: any; spend: number; contribution: number; purpose: GroupPurpose; members: any[] }[] = [];

    for (const spec of GROUPS) {
        const owner = U[spec.owner]!;
        const memberUsers = [owner, ...spec.others.map((i) => U[i]!)];

        const group = await Group.create({
            name: spec.name,
            purpose: spec.purpose,
            createdBy: owner._id,
            balance: 0,
            totalContribution: 0,
            // A paid tier needs the whole grant, not just the tier: helpers/planLimits
            // resolves the EFFECTIVE plan from tier + expiry, so a PRO group with a
            // null expiry would read as lapsed and fall back to FREE limits.
            ...(spec.plan && spec.plan !== 'FREE'
                ? {
                      plan: spec.plan,
                      planExpiresAt: new Date(now + 365 * dayMs),
                      planCycle: 'yearly' as const,
                      planSource: 'PAYMENT' as const,
                  }
                : {}),
        });

        // ── Categories ────────────────────────────────────────────────────────
        // Does this group's type record expenses? Neither a Reserve nor a Chit
        // does, so they get no expense categories and no spend below.
        const recordsExpenses = groupFeaturesOf(spec.purpose).expenses;

        // RESERVE's defaults are CREDIT buckets and CHIT has none at all, so each
        // entry's own type is honoured rather than forced to EXPENSE, and both
        // insertMany calls below tolerate an empty list.
        const defaults = PURPOSE_DEFAULT_CATEGORIES[spec.purpose];
        const purposeCreditCats = defaults.filter((d) => d.type === 'CREDIT');
        const expenseCats = await Category.insertMany(
            defaults.filter((d) => (d.type ?? 'EXPENSE') === 'EXPENSE').map((d, i) => ({
                groupId: group._id,
                name: d.name,
                color: d.color,
                type: 'EXPENSE',
                isSpecial: Boolean(d.isSpecial),
                // Give a couple of categories a soft limit so the meter and the
                // over-limit warning have something to render.
                limitCents: i === 1 ? 4_000_00 : i === 2 ? 1_500_00 : null,
            }))
        );
        const creditCats = await Category.insertMany(
            [...CREDIT_CATEGORIES, ...purposeCreditCats].map((c) => ({
                groupId: group._id,
                name: c.name,
                color: c.color,
                type: 'CREDIT',
            }))
        );

        // ── Generate the spend first ──────────────────────────────────────────
        const specs = Array.from({ length: recordsExpenses ? EXPENSES_PER_GROUP : 0 }, () => {
            const amount = intBetween(50, 1200);
            const payer = pick(memberUsers);
            // ~55% split between 2-4 members; the rest sit unsplit on the payer.
            const doSplit = rng() < 0.55;
            let splitBetween: { userId: mongoose.Types.ObjectId; amount: number }[] = [];
            if (doSplit) {
                const n = Math.min(intBetween(2, 4), memberUsers.length);
                const shuffled = [...memberUsers].sort(() => rng() - 0.5).slice(0, n);
                const parts = splitEvenly(amount, n);
                splitBetween = shuffled.map((m, i) => ({
                    userId: m._id as mongoose.Types.ObjectId,
                    amount: parts[i]!,
                }));
            }
            return {
                groupId: group._id,
                category: pick(expenseCats)._id,
                creditCategory: rng() < 0.4 ? pick(creditCats)._id : undefined,
                title: pick(TITLES),
                amount,
                paidBy: payer._id,
                paymentType: pick([...PAYMENT_TYPES]),
                date: new Date(now - Math.floor(rng() * DAYS) * dayMs - Math.floor(rng() * dayMs)),
                splitBetween,
            };
        });

        const spend = specs.reduce((s, e) => s + e.amount, 0);

        // ── Fund the wallet to cover it ───────────────────────────────────────
        const target = Math.ceil((spend * FUNDING_RATIO) / 1000) * 1000;
        const shares = splitEvenly(target, memberUsers.length);

        await GroupMember.insertMany(
            memberUsers.map((m, i) => ({
                groupId: group._id,
                userId: m._id,
                contribution: shares[i]!,
                role: i === 0 ? 'SUPER_ADMIN' : i === 1 ? 'ADMIN' : 'MEMBER',
            }))
        );

        // Skipped entirely when there is nothing to fund. A group whose type records
        // no expenses has target 0, and writing a row per member for ₹0 would put
        // ten meaningless CREDIT entries in the chit's ledger — money that never
        // moved, in the one place its rupees are supposed to reconcile exactly
        // against the rotation.
        if (target > 0) {
            // creditGroupBalance takes RAW RUPEES — the schema setter scales it.
            for (let i = 0; i < memberUsers.length; i++) {
                await creditGroupBalance(group._id, shares[i]!);
            }
            await GroupTransaction.insertMany(
                memberUsers.map((m, i) => ({
                    groupId: group._id,
                    amount: shares[i]!,
                    action: 'CREDIT',
                    description: `Contribution from ${m.name}`,
                    referenceId: m._id,
                    referenceModel: 'User',
                    category: creditCats[0]!._id,
                    performedBy: owner._id,
                    createdAt: new Date(now - DAYS * dayMs),
                }))
            );
        }

        // ── Expenses + their ledger rows ──────────────────────────────────────
        const expenses = await Expense.insertMany(specs);
        await GroupTransaction.insertMany(
            expenses.map((e, i) => ({
                groupId: group._id,
                amount: specs[i]!.amount,
                action: 'DEBIT',
                description: `Expense: ${e.title}`,
                referenceId: e._id,
                referenceModel: 'Expense',
                performedBy: e.paidBy,
                createdAt: e.date,
            }))
        );
        const debited = await debitGroupBalance(group._id, spend);
        if (!debited) throw new Error(`${spec.name}: balance could not cover ${spend}`);

        await GroupEvent.create({
            groupId: group._id,
            performedBy: owner._id,
            eventType: 'CREATE_GROUP',
            referenceId: group._id,
            referenceModel: 'Group',
            metadata: { note: 'Seeded test group' },
        });

        created.push({ group, spend, contribution: target, purpose: spec.purpose, members: memberUsers });
        console.log(`  ${group.displayId} ${spec.name}: ${expenses.length} expenses, spend ${spend}, funded ${target}`);
    }

    // ── A running chit, seeded mid-term ───────────────────────────────────────
    //
    // Written directly rather than by calling activate + markPaid + release,
    // because those services enforce a live clock: every cycle would fall due
    // today and the board would show four upcoming cycles and nothing else. The
    // point of seeding is to arrive in the MIDDLE of a term, so the states that
    // only appear over months — a short payout, arrears, an overdue cycle — are
    // there to look at on the first run.
    //
    // Everything the services would have written is written here too. In
    // particular each PAID due points at exactly one CREDIT row and each payout at
    // one DEBIT, which is the reconciliation invariant the due model documents and
    // the check at the bottom of this script verifies.
    const chitSeed = created.find((c) => c.purpose === 'CHIT');
    if (chitSeed) {
        const { group, members } = chitSeed;
        const AMOUNT = 5_000;
        const INTERVAL = 30;
        const DUE_DAYS = 10;
        const organizer = members[0]!;
        const participants = members.map((m, i) => ({ userId: m._id, position: i + 1 }));
        const pot = AMOUNT * participants.length;

        // Back-dated so cycle 5 of 10 is the live one and is already late. Cycle n
        // falls due on start + 30(n-1) + 10, so 135 days back puts cycles 1-4
        // behind us, cycle 5 five days overdue, and cycles 6-10 still ahead.
        const startDate = new Date(now - 135 * dayMs);
        const dueOf = (n: number) =>
            new Date(startDate.getTime() + (INTERVAL * (n - 1) + DUE_DAYS) * dayMs);

        const scheme = await ChitScheme.create({
            groupId: group._id,
            status: 'ACTIVE',
            amountPerMember: AMOUNT,
            totalCycles: participants.length,
            startDate,
            cycleIntervalDays: INTERVAL,
            dueDays: DUE_DAYS,
            organizerUserId: organizer._id,
            participants,
            activatedAt: startDate,
            createdBy: organizer._id,
        });

        const cycles = await ChitCycle.insertMany(
            participants.map((p) => ({
                schemeId: scheme._id,
                groupId: group._id,
                cycleNumber: p.position,
                status: 'COLLECTING' as const,
                recipientUserId: p.userId,
                expectedAmount: pot,
                dueDate: dueOf(p.position),
            }))
        );

        // One due per member per cycle, the cycle's own recipient included — they
        // pay like everyone else, which is what makes in == out over the term.
        // Nested loops rather than flatMap: this project targets ES2017.
        const dueDocs: Record<string, unknown>[] = [];
        for (const cycle of cycles) {
            for (const p of participants) {
                dueDocs.push({
                    schemeId: scheme._id,
                    cycleId: cycle._id,
                    groupId: group._id,
                    cycleNumber: cycle.cycleNumber,
                    userId: p.userId,
                    amount: AMOUNT,
                    dueDate: cycle.dueDate,
                });
            }
        }
        // insertMany over an untyped doc array widens to unknown[]; the rows are
        // ChitDue documents and are saved individually below, so name the type.
        const dues = (await ChitDue.insertMany(dueDocs)) as unknown as IChitDue[];

        const chitCategory = await getOrCreateChitCreditCategory(group._id);

        /**
         * WHO paid, per cycle — positions, not a count.
         *
         * Named rather than counted so a defaulter is a person whose story holds
         * across cycles: position 4 misses cycle 3 and never makes it up, so they
         * carry real ARREARS while still collecting their own pot in cycle 4,
         * which is exactly the situation a chit organiser has to be able to see.
         *
         * Between them these five rows put every state on the board at once:
         *   1, 2, 4  full houses, paid out for the whole pot
         *   3        one short, so it paid out short and froze a shortfall
         *   5        current, past its date, four dues reading MISSED
         *   6-10     untouched and PENDING
         */
        const ALL = participants.map((p) => p.position);
        const PAYERS_BY_CYCLE: number[][] = [
            ALL,                              // 1 — everyone
            ALL,                              // 2 — everyone
            ALL.filter((n) => n !== 4),       // 3 — position 4 defaults
            ALL,                              // 4 — everyone
            [1, 2, 4, 5, 6, 8],               // 5 — current; 3, 7, 9, 10 missed
            [], [], [], [], [],               // 6-10 — not yet due
        ];
        const PAID_OUT_THROUGH = 4;

        /**
         * Dues settled AFTER their date, as "cycle:position".
         *
         * A real chit is full of these, and they are the case the schema goes out
         * of its way to support: a late payment raises the cycle's collectedAmount
         * but never rewrites its shortfallAmount. Cycle 3's two late payers landed
         * before the payout, so that cycle's shortfall is position 4's alone.
         */
        const LATE = new Set(['2:7', '3:9', '4:3', '5:8']);

        await GroupEvent.create({
            groupId: group._id,
            performedBy: organizer._id,
            eventType: 'CHIT_UPDATED',
            referenceId: scheme._id,
            referenceModel: 'Group',
            metadata: {
                action: 'ACTIVATED',
                totalCycles: participants.length,
                note: `Chit started — ${participants.length} members, ₹${AMOUNT} each per cycle`,
            },
            createdAt: startDate,
        });

        for (const cycle of cycles) {
            const positions = PAYERS_BY_CYCLE[cycle.cycleNumber - 1] ?? [];
            const payers = participants.filter((p) => positions.includes(p.position));

            // Contributions first, then the payout — the order the real flow
            // enforces, and what keeps debitGroupBalance from refusing below.
            for (const p of payers) {
                const due = dues.find(
                    (d) =>
                        String(d.cycleId) === String(cycle._id) &&
                        String(d.userId) === String(p.userId)
                )!;
                const late = LATE.has(`${cycle.cycleNumber}:${p.position}`);
                const paidAt = new Date(
                    cycle.dueDate.getTime() +
                        (late ? intBetween(2, 8) : -intBetween(1, 6)) * dayMs
                );

                // Raw rupees: the schema setters scale, and Mongoose re-runs them on
                // $inc, so pre-converting would double-scale.
                await creditGroupBalance(group._id, AMOUNT);
                await adjustMemberContribution(group._id, p.userId, AMOUNT);

                const ledger = await GroupTransaction.create({
                    groupId: group._id,
                    amount: AMOUNT,
                    action: 'CREDIT',
                    description: `Chit contribution — cycle ${cycle.cycleNumber}`,
                    // The PAYING MEMBER, never the cycle: removeCreditService rolls a
                    // credit back by treating referenceId as the contributor.
                    referenceId: p.userId,
                    referenceModel: 'User',
                    category: chitCategory._id,
                    metadata: {
                        [CHIT_CREDIT_FLAG]: String(due._id),
                        chitCycleId: String(cycle._id),
                        cycleNumber: cycle.cycleNumber,
                    },
                    performedBy: organizer._id,
                    createdAt: paidAt,
                });

                due.status = 'PAID';
                due.paidAt = paidAt;
                due.paymentType = pick([...PAYMENT_TYPES]);
                due.recordedBy = organizer._id;
                due.transactionId = ledger._id as any;
                await due.save();

                await ChitCycle.updateOne({ _id: cycle._id }, { $inc: { collectedAmount: AMOUNT } });
            }

            if (cycle.cycleNumber > PAID_OUT_THROUGH) continue;

            const collected = payers.length * AMOUNT;
            const shortfall = Math.max(0, pot - collected);
            // What the recipient actually got: the full pot when it filled, otherwise
            // whatever was collected. Frozen here — a later payment raises
            // collectedAmount but never rewrites shortfallAmount.
            const payoutAmount = shortfall > 0 ? collected : pot;
            const paidAt = new Date(cycle.dueDate.getTime() + dayMs);

            const debited = await debitGroupBalance(group._id, payoutAmount);
            if (!debited) {
                throw new Error(`chit: wallet could not cover cycle ${cycle.cycleNumber} payout`);
            }

            await ChitCycle.updateOne(
                { _id: cycle._id },
                {
                    $set: {
                        status: 'PAID',
                        payoutAmount,
                        shortfallAmount: shortfall,
                        paidAt,
                        paidBy: organizer._id,
                    },
                }
            );

            await GroupTransaction.create({
                groupId: group._id,
                amount: payoutAmount,
                action: 'DEBIT',
                description: `Chit payout — cycle ${cycle.cycleNumber}`,
                referenceId: cycle.recipientUserId,
                referenceModel: 'User',
                metadata: { chitCycleId: String(cycle._id), cycleNumber: cycle.cycleNumber },
                performedBy: organizer._id,
                createdAt: paidAt,
            });

            await GroupEvent.create({
                groupId: group._id,
                performedBy: organizer._id,
                eventType: 'CHIT_PAYOUT',
                referenceId: cycle.recipientUserId,
                referenceModel: 'User',
                amount: payoutAmount,
                metadata: {
                    cycleNumber: cycle.cycleNumber,
                    shortfall,
                    note: `Chit cycle ${cycle.cycleNumber} paid out — ₹${payoutAmount}`,
                },
                createdAt: paidAt,
            });
        }

        const paidDues = PAYERS_BY_CYCLE.reduce((sum, row) => sum + row.length, 0);
        console.log(
            `  ${group.displayId} chit: ${participants.length} members × ₹${AMOUNT}, pot ₹${pot}, ` +
                `${PAID_OUT_THROUGH}/${participants.length} cycles paid out, ` +
                `${paidDues} contributions recorded (${LATE.size} late)`
        );
    }

    // ── Cross-group extras, so the newer features have data ───────────────────
    const [g1, g2, g3] = [created[0]!.group, created[1]!.group, created[2]!.group];

    // An active funding link: Household bankrolls Weekend Trips.
    const TRANSFER = 25_000;
    const link = await GroupLink.create({
        hostGroupId: g2._id,
        sourceGroupId: g1._id,
        status: 'ACTIVE',
        requestedBy: U[1]!._id,
        reviewedBy: U[0]!._id,
        reviewedAt: new Date(now - 20 * dayMs),
    });
    const moved = await debitGroupBalance(g1._id, TRANSFER);
    if (!moved) throw new Error('funding transfer exceeded the source wallet');
    await creditGroupBalance(g2._id, TRANSFER);
    await GroupLink.updateOne({ _id: link._id }, { $inc: { contribution: TRANSFER } });
    await GroupTransaction.insertMany([
        {
            groupId: g1._id, amount: TRANSFER, action: 'DEBIT',
            description: `Funded group ${g2.displayId}`,
            referenceId: g2._id, referenceModel: 'Group',
            performedBy: U[0]!._id, metadata: { linkId: String(link._id), direction: 'OUTGOING' },
        },
        {
            groupId: g2._id, amount: TRANSFER, action: 'CREDIT',
            description: 'Funding received from a connected group',
            referenceId: g1._id, referenceModel: 'Group',
            // transferToLinkedGroupService tags the incoming credit with the
            // host's "Other" credit category; without this the transfer would be
            // missing from the credit-category rollup and the seed would not
            // match what the app itself produces.
            category: (await Category.findOne({ groupId: g2._id, type: 'CREDIT', name: 'Other' }))?._id,
            performedBy: U[0]!._id, metadata: { linkId: String(link._id), direction: 'INCOMING' },
        },
    ]);

    // Tag some of the host's expenses to that funder — kept comfortably under
    // what was transferred so the over-attribution warning stays quiet.
    const taggable = await Expense.find({ groupId: g2._id, isDeleted: false })
        .sort({ date: -1 })
        .limit(60)
        .select('_id amount');
    let tagged = 0;
    const toTag: mongoose.Types.ObjectId[] = [];
    for (const e of taggable) {
        if (tagged + e.amount > TRANSFER * 0.6) break;
        toTag.push(e._id as mongoose.Types.ObjectId);
        tagged += e.amount;
    }
    await Expense.updateMany({ _id: { $in: toTag } }, { $set: { fundedByGroup: g1._id } });

    // A live join link on the first group.
    await GroupJoinLink.create({
        groupId: g1._id,
        token: generateJoinToken(),
        createdBy: U[0]!._id,
    });

    // test4 waiting in the third group's approval queue.
    await GroupInvite.create({
        groupId: g3._id,
        invitedUser: U[3]!._id,
        invitedBy: U[2]!._id,
        status: 'PENDING_APPROVAL',
        contribution: 5_000,
        respondedAt: new Date(now - 2 * dayMs),
    });

    // ── Reconcile ─────────────────────────────────────────────────────────────
    console.log('\nreconciliation (balance must equal credits − debits):');
    let bad = 0;
    for (const g of [...created.map((c) => c.group)]) {
        const fresh = await Group.findById(g._id).select('name displayId balance totalContribution');
        const rows = await GroupTransaction.aggregate([
            { $match: { groupId: g._id, isDeleted: false } },
            { $group: { _id: '$action', cents: { $sum: '$amount' } } },
        ]);
        const by = (a: string) => (rows.find((r) => r._id === a)?.cents ?? 0) / 100;
        const expected = by('CREDIT') - by('DEBIT') + by('REFUND');
        const actual = fresh!.balance;
        const ok = Math.abs(expected - actual) < 0.01;
        if (!ok) bad++;
        console.log(
            `  ${fresh!.displayId} ${ok ? 'OK  ' : 'MISMATCH'} balance=${actual} ledger=${expected} contributed=${fresh!.totalContribution}`
        );
    }

    const totalExpenses = await Expense.countDocuments({
        groupId: { $in: created.map((c) => c.group._id) },
        isDeleted: false,
    });
    console.log(`\ntotal expenses seeded: ${totalExpenses}`);
    console.log(`expenses tagged to a funding group: ${toTag.length} (₹${tagged} of ₹${TRANSFER})`);

    await mongoose.disconnect();
    if (bad > 0) throw new Error(`${bad} group(s) failed reconciliation`);
    console.log('done');
};

seed().catch(async (err) => {
    console.error('seed failed:', err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
