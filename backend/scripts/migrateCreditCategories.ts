/**
 * Backfill for the credit-category feature.
 *
 *   1. Stamp `type: "EXPENSE"` on every pre-existing category that has no type.
 *   2. Drop the legacy unique index { groupId, name } and re-sync indexes so the
 *      new { groupId, type, name } unique index takes over (lets an expense and
 *      a credit category share a name, e.g. both "Other").
 *   3. Ensure each group has an "Other" CREDIT category and point every existing
 *      CREDIT transaction that lacks a `category` at it ("change the current
 *      credits in other category").
 *
 * Usage (from backend/):
 *   npx ts-node scripts/migrateCreditCategories.ts            # dry-run
 *   npx ts-node scripts/migrateCreditCategories.ts --apply    # write changes
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import Category from "../models/category.model";
import GroupTransaction from "../models/group_transaction.model";
import { OTHER_CREDIT_CATEGORY } from "../services/category.service";

const OTHER = OTHER_CREDIT_CATEGORY;

const APPLY = process.argv.includes("--apply");

async function run() {
    await mongoose.connect(env.MONGO_URI);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will write)" : "DRY-RUN (read-only)"}\n`);

    // ── 1. Backfill type on legacy categories ──
    const missingType = await Category.countDocuments({ type: { $exists: false } });
    console.log(`Categories without a type: ${missingType}`);
    if (APPLY && missingType > 0) {
        const res = await Category.updateMany(
            { type: { $exists: false } },
            { $set: { type: "EXPENSE" } }
        );
        console.log(`  → stamped EXPENSE on ${res.modifiedCount} categories`);
    }

    // ── 2. Replace the legacy unique index ──
    if (APPLY) {
        const indexes = await Category.collection.indexes();
        const legacy = indexes.find((i) => i.name === "groupId_1_name_1");
        if (legacy) {
            await Category.collection.dropIndex("groupId_1_name_1");
            console.log("  → dropped legacy index groupId_1_name_1");
        }
        await Category.syncIndexes();
        console.log("  → synced Category indexes");
    } else {
        console.log("(dry-run) would drop legacy index groupId_1_name_1 and sync indexes");
    }

    // ── 3. Ensure an "Other" credit category per group + backfill credits ──
    const groupIds = await GroupTransaction.distinct("groupId", { action: "CREDIT", isDeleted: false });
    console.log(`\nGroups with credits: ${groupIds.length}`);

    let creditsBackfilled = 0;
    let categoriesCreated = 0;

    for (const groupId of groupIds) {
        const untagged = await GroupTransaction.countDocuments({
            groupId,
            action: "CREDIT",
            isDeleted: false,
            category: null,
        });
        if (untagged === 0) continue;

        let other = await Category.findOne({
            groupId,
            type: "CREDIT",
            name: OTHER.name,
            isDeleted: false,
        });

        if (!other && APPLY) {
            other = await Category.create({
                groupId,
                type: "CREDIT",
                name: OTHER.name,
                color: OTHER.color,
            });
            categoriesCreated++;
        }

        console.log(`  ${groupId}: ${untagged} credits → "Other"${other ? "" : " (would create category)"}`);

        if (APPLY && other) {
            const res = await GroupTransaction.updateMany(
                { groupId, action: "CREDIT", isDeleted: false, category: null },
                { $set: { category: other._id } }
            );
            creditsBackfilled += res.modifiedCount;
        }
    }

    console.log(
        `\nDone. ${APPLY ? `credit categories created: ${categoriesCreated}, credits tagged: ${creditsBackfilled}` : "run with --apply to write"}`
    );
}

run()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(async () => { await mongoose.disconnect(); });
