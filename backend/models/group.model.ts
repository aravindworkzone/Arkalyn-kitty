import mongoose, { Document, Schema } from "mongoose";
import Counter from "./counter.model";
import { toDBAmount, fromDBAmount } from "../helpers/Money";
import {
    PLAN_TIERS, PLAN_SOURCES, BILLING_CYCLES,
    type Plan, type PlanSource, type BillingCycle,
} from "../config/constants";

export interface IGroupPlanSnapshot {
    tier: Plan;
    snapshotAt: Date;
}

// The STORAGE enum: every value a group document may carry. FRIENDS, ROOMMATES,
// TEAM and OTHER are LEGACY — they exist on groups created before purpose meant
// anything, and removing them would strand that data behind an enum that no
// longer accepts it. They are absent from SELECTABLE_GROUP_PURPOSES below, and
// config/groupTypeFeatures.ts resolves every one of them to the FAMILY feature
// set, which is exactly how those groups already behave.
//
// Same arrangement as PLAN_TIERS vs SELLABLE_TIERS in config/constants.ts: a wide
// storage enum that carries history, and a narrow list of what is offered today.
export const GROUP_PURPOSES = ["FAMILY", "FRIENDS", "ROOMMATES", "TEAM", "RESERVE", "OTHER", "CHIT"] as const;
export type GroupPurpose = typeof GROUP_PURPOSES[number];

// The three types a user can actually pick. Group creation validates against
// this, not GROUP_PURPOSES, so no new group can be created on a legacy value.
//
// Purpose now decides which FEATURES a group has, which is why creation must
// reject anything unrecognised rather than falling back to a default: a silent
// coercion would hand a group the wrong feature set and, because type is
// immutable, there would be no way to correct it afterwards.
export const SELECTABLE_GROUP_PURPOSES = ["FAMILY", "CHIT", "RESERVE"] as const;
export type SelectableGroupPurpose = typeof SELECTABLE_GROUP_PURPOSES[number];

// Mirrors isSellablePlan in config/constants.ts — same storage-vs-offered split,
// same narrowing predicate, so the two read alike at their call sites.
export const isSelectableGroupPurpose = (p: unknown): p is SelectableGroupPurpose =>
    typeof p === "string" && (SELECTABLE_GROUP_PURPOSES as readonly string[]).includes(p);

export interface IGroup extends Document {
    displayId: string;
    name: string;
    groupType: "POOL" | "SPLIT";
    purpose: GroupPurpose;
    balance: number;
    totalContribution: number;
    status: "ACTIVE" | "INACTIVE" | "CLOSED";
    // ── Subscription (group-scoped) ──────────────────────────────────────────
    // The tier last purchased FOR THIS GROUP. Every entitlement — member cap,
    // category cap, log retention, custom reports, clone, linking — is governed
    // by these fields alone; the buyer's account has no tier of its own. The
    // *effective* tier (expiry + grace applied) is computed by
    // helpers/planLimits.ts, so this is stored state and is never gated on
    // directly.
    plan: Plan;
    // When paid access ends. `null` on FREE (never expires).
    planExpiresAt: Date | null;
    // Cycle + origin of the current grant — drives revenue reporting (only
    // PAYMENT counts as revenue; PROMO/ADMIN are comps).
    planCycle: BillingCycle | null;
    planSource: PlanSource | null;
    // Frozen at close: the group's plan tier at the moment it was closed.
    // Immutable thereafter — protects refund calc / audit from later plan changes.
    planSnapshot?: IGroupPlanSnapshot | null;
    createdBy: mongoose.Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const planSnapshotSchema = new Schema<IGroupPlanSnapshot>({
    tier: { type: String, enum: PLAN_TIERS },
    snapshotAt: { type: Date, default: Date.now },
}, { _id: false });

const groupSchema = new Schema<IGroup>({
    displayId: {type: String, unique: true, sparse: true},
    name: {type: String, required: true , trim: true, minlength: 3, maxlength: 100},
    groupType: {type: String, enum: ["POOL", "SPLIT"], default: "POOL"},
    purpose: {type: String, enum: GROUP_PURPOSES, default: "OTHER"},
    balance: {type: Number, default: 0, set:toDBAmount, get:fromDBAmount},
    totalContribution: {type: Number, default: 0, set:toDBAmount, get:fromDBAmount},
    status: {type: String, enum: ["ACTIVE", "INACTIVE", "CLOSED"], default: "ACTIVE"},
    plan: {type: String, enum: PLAN_TIERS, default: 'FREE', index: true},
    planExpiresAt: {type: Date, default: null},
    planCycle: {type: String, enum: BILLING_CYCLES, default: null},
    planSource: {type: String, enum: PLAN_SOURCES, default: null},
    planSnapshot: { type: planSnapshotSchema, default: null },
    createdBy: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true}
}, {timestamps: true, toJSON: { getters: true }, toObject: { getters: true }});

groupSchema.pre("findOneAndDelete", async function() {
    try {
        const groupId = this.getQuery()["_id"];
        if(!groupId) return;
        await mongoose.model("Expense").deleteMany({ groupId });
        await mongoose.model("Category").deleteMany({ groupId });
        await mongoose.model("GroupMember").deleteMany({ groupId });
        await mongoose.model("GroupEvent").updateMany({ groupId }, { $set: { isDeleted: true } });
        await mongoose.model("GroupTransaction").updateMany({ groupId }, { $set: { isDeleted: true } });
        await mongoose.model("GroupLink").updateMany(
            { $or: [{ hostGroupId: groupId }, { sourceGroupId: groupId }] },
            { $set: { isDeleted: true, status: "REVOKED" } }
        );
        await mongoose.model("GroupJoinLink").deleteMany({ groupId });
        // The chit's three collections. Hard-deleted rather than soft, because
        // unlike the ledgers they describe nothing outside this group — a due or a
        // cycle belonging to a group that no longer exists is unreachable, and the
        // money they moved is already recorded in GroupTransaction, which is kept.
        // Without this a deleted group orphans its scheme, and the partial unique
        // index on { groupId } keeps indexing rows nothing can ever reach again.
        await mongoose.model("ChitDue").deleteMany({ groupId });
        await mongoose.model("ChitCycle").deleteMany({ groupId });
        await mongoose.model("ChitScheme").deleteMany({ groupId });
        await mongoose.model("Expense").updateMany(
            { fundedByGroup: groupId },
            { $unset: { fundedByGroup: "" } }
        );
    } catch (error) {
        if(error instanceof Error) throw new Error(error.message);
        throw new Error("An unknown error occurred");
    }
});

groupSchema.pre("save", async function () {
    if (!this.isNew) return;

    try {
        const year = new Date().getFullYear().toString().slice(-2);
        const key = `Grp-${year}`;
    
        const counter = await Counter.findOneAndUpdate(
            { _id: key },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        if (!counter) throw new Error("Failed to generate group display ID");
        const id = `${key}-${String(counter.seq).padStart(3, "0")}`;
        this.displayId = id;
    } catch (error) {
        if(error instanceof Error) throw new Error(error.message);
        throw new Error("An unknown error occurred");
    }
});

export default mongoose.model<IGroup>("Group", groupSchema);