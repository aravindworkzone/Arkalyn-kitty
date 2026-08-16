import mongoose , { Document, Schema} from 'mongoose';
import {
    USER_ROLES, USER_STATUSES, AUTH_PROVIDERS,
    type UserRole, type UserStatus, type AuthProvider
} from '../config/constants';

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    status: UserStatus;
    // NOTE: accounts carry no subscription tier. Plans are bought per GROUP and
    // live on the Group document (`plan`, `planExpiresAt`, `planCycle`,
    // `planSource`); a user's entitlements are always those of the group they
    // are acting in. SubscriptionPayment.userId records who paid, nothing more.
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
    authProvider: AuthProvider | null;
    googleId?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const userSchema = new Schema<IUser>({
    name: {type: String, required: true, trim: true, index: true},
    email: {type: String, required: true, unique: true, lowercase: true, trim: true, match: [/\S+@\S+\.\S+/, "Please enter a valid email"]},
    password: {type: String, required: function(this: IUser) { return this.authProvider === 'LOCAL';}},
    role: {type: String, enum: USER_ROLES, default: 'USER', index: true},
    status: {type: String, enum: USER_STATUSES, default: 'ACTIVE', index: true},
    lastLoginAt: {type: Date, default: null},
    // select:false — the hash never ships in a normal query/response; apiKeyAuth
    // opts in explicitly with .select('+apiKey'). The prefix index makes the
    // per-request key lookup a single keyed read instead of a collection scan.
    apiKey: {type: String, default: null, select: false},
    apiKeyPrefix: {type: String, default: null, index: true},
    apiKeyCreatedAt: {type: Date, default: null},
    authProvider: {type: String, enum: AUTH_PROVIDERS, default: 'LOCAL'},
    googleId: {type: String},
}, {timestamps: true});

// Admin user list sorts by newest first over the whole collection; an index on
// createdAt avoids an in-memory sort of every user on each dashboard page load.
userSchema.index({ createdAt: -1 });
userSchema.index({ googleId: 1}, { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } });

export default mongoose.model<IUser>("User", userSchema);