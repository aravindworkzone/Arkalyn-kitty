/**
 * READ-ONLY diagnostic for the "contribution shows 10x" report.
 *
 * Prints, per recent group, each member's raw stored contribution (cents) and
 * the getter-converted value (rupees), plus the latest CREDIT transaction's raw
 * and converted amount. This shows whether a wrong value lives in the DB (write
 * bug) or only on screen (display bug).
 *
 *   npx ts-node scripts/inspectContribution.ts
 *   npx ts-node scripts/inspectContribution.ts --group=Grp-26-039
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import Group from "../models/group.model";
import GroupMember from "../models/group_member.model";
import GroupTransaction from "../models/group_transaction.model";

const groupArg = process.argv.find((a) => a.startsWith("--group="))?.split("=")[1];

async function run() {
    await mongoose.connect(env.MONGO_URI);

    const filter: Record<string, unknown> = {};
    if (groupArg) filter[mongoose.Types.ObjectId.isValid(groupArg) ? "_id" : "displayId"] = groupArg;

    const groups = await Group.find(filter).sort({ updatedAt: -1 }).limit(groupArg ? 1 : 3).lean<{
        _id: mongoose.Types.ObjectId; displayId: string; name: string;
        balance: number; totalContribution: number;
    }[]>();

    for (const g of groups) {
        console.log(`\n=== ${g.displayId} — ${g.name} ===`);
        console.log(`  group.balance           raw(cents)=${g.balance}   →  ₹${g.balance / 100}`);
        console.log(`  group.totalContribution raw(cents)=${g.totalContribution}   →  ₹${g.totalContribution / 100}`);

        // .lean() bypasses the getter → raw cents as stored.
        const membersRaw = await GroupMember.find({ groupId: g._id, isDeleted: false }).lean<{ userId: mongoose.Types.ObjectId; contribution: number }[]>();
        for (const m of membersRaw) {
            console.log(`  member ${m.userId}  contribution raw(cents)=${m.contribution}   →  ₹${m.contribution / 100}`);
        }

        const credits = await GroupTransaction.find({ groupId: g._id, action: "CREDIT", isDeleted: false }).sort({ createdAt: 1 }).lean<{ amount: number; description: string; createdAt: Date }[]>();
        console.log(`  --- all ${credits.length} CREDIT(s) (raw cents → ₹) ---`);
        let sum = 0;
        for (const c of credits) {
            sum += c.amount;
            console.log(`    ${new Date(c.createdAt).toISOString().slice(0, 16)}  ${String(c.amount).padStart(9)} → ₹${c.amount / 100}   "${c.description.slice(0, 50)}"`);
        }
        console.log(`  CREDIT sum raw(cents)=${sum} → ₹${sum / 100}`);
    }
    console.log("");
}

run()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(async () => { await mongoose.disconnect(); });
