/**
 * Recompute group balances AND member contributions from the immutable
 * GroupTransaction ledger (the source of truth).
 *
 *   balance            = Σ(CREDIT + REFUND) − Σ(DEBIT)   over non-deleted txns
 *   totalContribution  = Σ(CREDIT)                       over non-deleted txns
 *   member.contribution= Σ(CREDIT where referenceId = member.userId)
 *
 * The ledger amounts are written via document construction (single conversion)
 * so they are correct, whereas balances/contributions were corrupted by a
 * double-conversion bug on $inc (toDBAmount applied by the service AND again by
 * the schema setter → 100×). This rebuilds the stored values from the ledger.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/recalcBalance.ts                 # dry-run, all groups
 *   npx ts-node scripts/recalcBalance.ts --group=Grp-26-018
 *   npx ts-node scripts/recalcBalance.ts --apply         # repair drifted groups
 *
 * Works in raw integer cents; converts to rupees only for display. Writes use
 * the native collection driver so the schema setter never fires.
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import Group from "../models/group.model";
import GroupMember from "../models/group_member.model";
import GroupTransaction from "../models/group_transaction.model";

const APPLY = process.argv.includes("--apply");
const groupArg = process.argv.find((a) => a.startsWith("--group="))?.split("=")[1];

const r = (cents: number) => `₹${(cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function run() {
    await mongoose.connect(env.MONGO_URI);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will write)" : "DRY-RUN (read-only)"}\n`);

    const groupFilter: Record<string, unknown> = {};
    if (groupArg) groupFilter[mongoose.Types.ObjectId.isValid(groupArg) ? "_id" : "displayId"] = groupArg;

    const groups = await Group.find(groupFilter).lean<{
        _id: mongoose.Types.ObjectId; displayId: string; name: string; status: string;
        balance: number; totalContribution: number;
    }[]>();

    if (groups.length === 0) { console.log("No matching groups."); return; }
    const groupIds = groups.map((g) => g._id);

    // Per-group ledger totals (raw cents).
    const ledger = await GroupTransaction.aggregate([
        { $match: { isDeleted: { $ne: true }, groupId: { $in: groupIds } } },
        {
            $group: {
                _id: "$groupId",
                balance: { $sum: { $cond: [{ $eq: ["$action", "DEBIT"] }, { $multiply: ["$amount", -1] }, "$amount"] } },
                contribution: { $sum: { $cond: [{ $eq: ["$action", "CREDIT"] }, "$amount", 0] } },
            },
        },
    ]);
    const ledgerMap = new Map(ledger.map((l) => [l._id.toString(), l]));

    // Per-(group, contributing user) CREDIT totals — drives member.contribution.
    const perMember = await GroupTransaction.aggregate([
        { $match: { isDeleted: { $ne: true }, action: "CREDIT", groupId: { $in: groupIds } } },
        { $group: { _id: { groupId: "$groupId", userId: "$referenceId" }, contribution: { $sum: "$amount" } } },
    ]);
    const memberLedger = new Map(perMember.map((m) => [`${m._id.groupId}|${m._id.userId}`, m.contribution as number]));

    let groupsFixed = 0;
    let membersFixed = 0;

    for (const g of groups) {
        const l = ledgerMap.get(g._id.toString());
        const ledgerBalance = g.status === "CLOSED" ? 0 : (l?.balance ?? 0);
        const ledgerContribution = l?.contribution ?? 0;

        const members = await GroupMember.find({ groupId: g._id }).lean<{ _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; contribution: number; isDeleted: boolean }[]>();

        const balDrift = g.balance - ledgerBalance;
        const contribDrift = g.totalContribution - ledgerContribution;
        const memberDrifts = members
            .map((m) => ({ m, want: memberLedger.get(`${g._id}|${m.userId}`) ?? 0 }))
            .filter(({ m, want }) => m.contribution !== want);

        if (balDrift === 0 && contribDrift === 0 && memberDrifts.length === 0) continue;

        console.log(`⚠ ${g.displayId} — ${g.name}${g.status === "CLOSED" ? " [CLOSED]" : ""}`);
        if (balDrift !== 0)
            console.log(`    balance:           ${r(g.balance)}  →  ${r(ledgerBalance)}`);
        if (contribDrift !== 0)
            console.log(`    totalContribution: ${r(g.totalContribution)}  →  ${r(ledgerContribution)}`);
        for (const { m, want } of memberDrifts)
            console.log(`    member ${m.userId}: ${r(m.contribution)}  →  ${r(want)}`);

        if (ledgerBalance < 0) {
            console.log(`    ‼ Ledger sums negative — skipping (a transaction is bad).`);
            console.log("");
            continue;
        }

        if (APPLY) {
            if (balDrift !== 0 || contribDrift !== 0) {
                await Group.collection.updateOne(
                    { _id: g._id },
                    { $set: { balance: ledgerBalance, totalContribution: ledgerContribution } }
                );
                groupsFixed++;
            }
            for (const { m, want } of memberDrifts) {
                await GroupMember.collection.updateOne({ _id: m._id }, { $set: { contribution: want } });
                membersFixed++;
            }
            console.log(`    fixed.`);
        }
        console.log("");
    }

    console.log(`\nGroups scanned: ${groups.length} | ${APPLY ? `groups fixed: ${groupsFixed}, members fixed: ${membersFixed}` : "run with --apply to fix"}`);
}

run()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(async () => { await mongoose.disconnect(); });
