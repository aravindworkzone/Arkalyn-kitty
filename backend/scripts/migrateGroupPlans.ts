import mongoose from 'mongoose';
import { env } from '../config/env';
import Group from '../models/group.model';
import GroupMember from '../models/group_member.model';
import SubscriptionPayment from '../models/subscription_payment.model';

/**
 * One-shot migration: account subscriptions -> group subscriptions.
 *
 *   npm run migrate:group-plans          (dry run — reports, changes nothing)
 *   npm run migrate:group-plans -- --apply
 *
 * Subscriptions used to live on the User (`plan`, `planExpiresAt`, `planCycle`,
 * `planSource`) and a group inherited whatever its SUPER_ADMIN happened to hold.
 * They now live on the Group itself. Without this pass, every paying customer
 * silently drops to FREE limits the moment the new code ships, because the new
 * gates read fields that are empty on existing group documents.
 *
 * What it does:
 *
 *  1. PLANS. For each user still carrying a paid, non-expired tier, copy it onto
 *     every open group they own. That preserves exactly what those groups could
 *     do the day before: under the old rules the owner's tier governed all of
 *     them at once. It is deliberately generous — one account plan can become
 *     several group plans — because the alternative is silently revoking access
 *     someone paid for. Grant dates are carried over untouched, so nothing is
 *     extended and everything still expires when it always would have.
 *
 *  2. PAYMENTS. Backfill `SubscriptionPayment.groupId`, which is required going
 *     forward but cannot exist on historical rows — those purchases were never
 *     made for a group. Each is attributed to the payer's earliest-created owned
 *     group, the most likely beneficiary, so the profile receipts list stays
 *     readable. Rows whose payer owns nothing are left alone and simply render
 *     without a group.
 *
 *  3. INDEX. Drop the stale `promoCodeId_1_userId_1` unique index on
 *     promoredemptions. Redemption is now one-per-GROUP; leaving the old index
 *     in place would wrongly refuse a second group redeeming the same code.
 *     Mongoose creates the new (promoCodeId, groupId) index on its own but never
 *     removes a superseded one.
 *
 * Idempotent: re-running finds nothing left to do. It never clears the old user
 * fields — they are simply no longer read, and leaving them makes this
 * reversible if the deploy has to be rolled back.
 */

const APPLY = process.argv.includes('--apply');

interface LegacyUser {
    _id: mongoose.Types.ObjectId;
    email?: string;
    plan?: string;
    planExpiresAt?: Date | null;
    planCycle?: string | null;
    planSource?: string | null;
}

// Read through the driver, not the User model: `plan` and friends are gone from
// the schema, so Mongoose would strip them from the result.
const legacyUsers = async (): Promise<LegacyUser[]> => {
    const db = mongoose.connection.db;
    if (!db) throw new Error('No database handle');
    return db
        .collection<LegacyUser>('users')
        .find({ plan: { $in: ['PRO', 'PREMIUM'] } })
        .project<LegacyUser>({ email: 1, plan: 1, planExpiresAt: 1, planCycle: 1, planSource: 1 })
        .toArray();
};

const ownedOpenGroupIds = async (userId: mongoose.Types.ObjectId) => {
    const ids = await GroupMember.distinct('groupId', {
        userId,
        role: 'SUPER_ADMIN',
        isDeleted: false,
    });
    const groups = await Group.find({ _id: { $in: ids }, status: { $ne: 'CLOSED' } })
        .select('_id')
        .sort({ createdAt: 1 });
    return groups.map((g) => g._id as mongoose.Types.ObjectId);
};

const migrate = async () => {
    const uri = env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not set');

    await mongoose.connect(uri);
    console.log(`connected: ${mongoose.connection.name}`);
    console.log(APPLY ? 'MODE: apply\n' : 'MODE: dry run (pass --apply to write)\n');

    // ── 1. Plans ─────────────────────────────────────────────────────────────
    const users = await legacyUsers();
    const now = Date.now();
    const planReport: { user: string; tier: string; groups: number; note: string }[] = [];
    let groupsUpgraded = 0;

    for (const u of users) {
        const expired = u.planExpiresAt ? u.planExpiresAt.getTime() < now : false;
        if (expired) {
            planReport.push({ user: u.email ?? String(u._id), tier: u.plan!, groups: 0, note: 'skipped — already expired' });
            continue;
        }

        const groupIds = await ownedOpenGroupIds(u._id);
        if (groupIds.length === 0) {
            planReport.push({ user: u.email ?? String(u._id), tier: u.plan!, groups: 0, note: 'skipped — owns no open group' });
            continue;
        }

        // Never downgrade: a group already carrying a plan (a re-run, or a
        // purchase made after the new code shipped) keeps what it has.
        const target = { _id: { $in: groupIds }, $or: [{ plan: 'FREE' }, { plan: { $exists: false } }] };

        if (APPLY) {
            const res = await Group.updateMany(target, {
                $set: {
                    plan: u.plan,
                    planExpiresAt: u.planExpiresAt ?? null,
                    planCycle: u.planCycle ?? 'monthly',
                    planSource: u.planSource ?? 'ADMIN',
                },
            });
            groupsUpgraded += res.modifiedCount;
            planReport.push({ user: u.email ?? String(u._id), tier: u.plan!, groups: res.modifiedCount, note: 'copied to owned groups' });
        } else {
            const n = await Group.countDocuments(target);
            groupsUpgraded += n;
            planReport.push({ user: u.email ?? String(u._id), tier: u.plan!, groups: n, note: 'would copy to owned groups' });
        }
    }

    console.log(`Paid accounts found: ${users.length}`);
    if (planReport.length > 0) console.table(planReport);
    console.log(`Groups ${APPLY ? 'upgraded' : 'that would be upgraded'}: ${groupsUpgraded}\n`);

    // ── 2. Payments ──────────────────────────────────────────────────────────
    const orphanPayments = await SubscriptionPayment.find({ groupId: { $exists: false } }).select('_id userId');
    let paymentsLinked = 0;
    let paymentsUnattributable = 0;

    for (const p of orphanPayments) {
        const [earliest] = await ownedOpenGroupIds(p.userId);
        if (!earliest) {
            paymentsUnattributable += 1;
            continue;
        }
        if (APPLY) {
            await SubscriptionPayment.updateOne({ _id: p._id }, { $set: { groupId: earliest } });
        }
        paymentsLinked += 1;
    }

    console.log(`Legacy payments without a group: ${orphanPayments.length}`);
    console.log(`  ${APPLY ? 'linked' : 'would link'} to the payer's earliest group: ${paymentsLinked}`);
    console.log(`  left unattributed (payer owns no group): ${paymentsUnattributable}\n`);

    // ── 3. Stale unique index ────────────────────────────────────────────────
    const db = mongoose.connection.db;
    if (!db) throw new Error('No database handle');
    const redemptions = db.collection('promoredemptions');
    const indexes = await redemptions.indexes().catch(() => []);
    const stale = indexes.find((i) => i.name === 'promoCodeId_1_userId_1');

    if (!stale) {
        console.log('Stale promoredemptions index: not present (nothing to drop)');
    } else if (APPLY) {
        await redemptions.dropIndex('promoCodeId_1_userId_1');
        console.log('Stale promoredemptions index: dropped promoCodeId_1_userId_1');
    } else {
        console.log('Stale promoredemptions index: would drop promoCodeId_1_userId_1');
    }

    if (!APPLY) console.log('\nNothing was written. Re-run with --apply to commit.');

    await mongoose.disconnect();
    console.log('done');
};

migrate().catch(async (err) => {
    console.error('migration failed:', err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
