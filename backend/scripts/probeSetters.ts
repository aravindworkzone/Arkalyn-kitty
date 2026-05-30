/**
 * READ-ONLY-ish probe: determines whether Mongoose applies a path `set:` setter
 * on $inc / $set update operators and on query filters, for a schema that uses
 * set:toDBAmount/get:fromDBAmount (like our money fields).
 *
 * Uses a dedicated throwaway collection (`__setter_probe`) and drops it at the
 * end — it never touches real data.
 *
 *   npx ts-node scripts/probeSetters.ts
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import { toDBAmount, fromDBAmount } from "../helpers/Money";

const schema = new mongoose.Schema({
    balance: { type: Number, default: 0, set: toDBAmount, get: fromDBAmount },
}, { collection: "__setter_probe" });

const Probe = mongoose.model("__SetterProbe", schema);

async function raw(id: mongoose.Types.ObjectId) {
    const doc = await Probe.collection.findOne({ _id: id });
    return doc?.balance;
}

async function run() {
    await mongoose.connect(env.MONGO_URI);
    await Probe.collection.deleteMany({});

    // 1) Construction: new Probe({ balance: 100 }) — expect raw 10000 (one setter).
    const d = await Probe.create({ balance: 100 });
    console.log(`construct balance:100 → raw ${await raw(d._id)} (single-convert => 10000)`);

    // 2) $inc by toDBAmount(50)=5000 — if setter re-applies, raw jumps by 500000.
    await Probe.updateOne({ _id: d._id }, { $inc: { balance: toDBAmount(50) } });
    console.log(`$inc toDBAmount(50)=5000 → raw ${await raw(d._id)} (no setter => 15000 | setter => 510000)`);

    // 3) $set toDBAmount(7)=700 — if setter re-applies, stored 70000.
    await Probe.updateOne({ _id: d._id }, { $set: { balance: toDBAmount(7) } });
    console.log(`$set toDBAmount(7)=700 → raw ${await raw(d._id)} (no setter => 700 | setter => 70000)`);

    // 4) Query filter: does setter run on conditions? Set raw to 10000 (=₹100),
    //    then query $gte with toDBAmount(100)=10000. If setter runs on query it
    //    becomes >=1000000 and won't match.
    await Probe.collection.updateOne({ _id: d._id }, { $set: { balance: 10000 } });
    const matchPlainCents = await Probe.findOne({ _id: d._id, balance: { $gte: toDBAmount(100) } });
    console.log(`query $gte toDBAmount(100)=10000 vs raw 10000 → ${matchPlainCents ? "MATCHED (query setter OFF)" : "no match (query setter ON)"}`);

    await Probe.collection.drop().catch(() => {});
    console.log("\nfromDBAmount sanity:", fromDBAmount(10000), "(=100)");
}

run()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(async () => { await mongoose.disconnect(); });
