import mongoose , { Document, Schema} from 'mongoose';
import {
    PLAN_TIERS, USER_ROLES, USER_STATUSES, PLAN_SOURCES, BILLING_CYCLES,
    type Plan, type UserRole, type UserStatus, type PlanSource, type BillingCycle,
} from '../config/constants';

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    status: UserStatus;
    // Last purchased subscription tier. The *effective* tier (accounting for
    // expiry + grace period) is computed by helpers/planLimits.ts — this field
    // is just the stored state, never read directly for gating.
    plan: Plan;
    // When the paid access ends. `null` for FREE (never expires).
    planExpiresAt: Date | null;
    // Billing cycle + origin of the current plan — used for revenue (MRR/ARR).
    planCycle: BillingCycle | null;
    planSource: PlanSource | null;
    lastLoginAt: Date | null;
    // Personal API key for read-only programmatic access (MCP server).
    // `apiKey` is the bcrypt hash — never the plaintext, which is shown to the
    // user exactly once at generation. `apiKeyPrefix` is the plaintext leading
    // segment kept for display ("ak_live_XXXXXXXX…") AND as a fast lookup filter
    // so apiKeyAuth can narrow candidates before the (non-deterministic) bcrypt
    // compare. All three are null until a key is generated, cleared on revoke.
    apiKey: string | null;
    apiKeyPrefix: string | null;
    apiKeyCreatedAt: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

const userSchema = new Schema<IUser>({
    name: {type: String, required: true, trim: true, index: true},
    email: {type: String, required: true, unique: true, lowercase: true, trim: true, match: [/\S+@\S+\.\S+/, "Please enter a valid email"]},
    password: {type: String, required: true},
    role: {type: String, enum: USER_ROLES, default: 'USER', index: true},
    status: {type: String, enum: USER_STATUSES, default: 'ACTIVE', index: true},
    plan: {type: String, enum: PLAN_TIERS, default: 'FREE'},
    planExpiresAt: {type: Date, default: null},
    planCycle: {type: String, enum: BILLING_CYCLES, default: null},
    planSource: {type: String, enum: PLAN_SOURCES, default: null},
    lastLoginAt: {type: Date, default: null},
    // select:false — the hash never ships in a normal query/response; apiKeyAuth
    // opts in explicitly with .select('+apiKey'). The prefix index makes the
    // per-request key lookup a single keyed read instead of a collection scan.
    apiKey: {type: String, default: null, select: false},
    apiKeyPrefix: {type: String, default: null, index: true},
    apiKeyCreatedAt: {type: Date, default: null},
}, {timestamps: true});

// Admin user list sorts by newest first over the whole collection; an index on
// createdAt avoids an in-memory sort of every user on each dashboard page load.
userSchema.index({ createdAt: -1 });

export default mongoose.model<IUser>("User", userSchema);