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
    lastLoginAt: Date | null;
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
    apiKey: {type: String, default: null, select: false},
    apiKeyPrefix: {type: String, default: null, index: true},
    apiKeyCreatedAt: {type: Date, default: null},
    authProvider: {type: String, enum: AUTH_PROVIDERS, default: 'LOCAL'},
    googleId: {type: String},
}, {timestamps: true});

userSchema.index({ createdAt: -1 });
userSchema.index({ googleId: 1}, { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } });

export default mongoose.model<IUser>("User", userSchema);