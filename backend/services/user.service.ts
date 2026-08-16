import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import GroupMember from '../models/group_member.model';
import User from '../models/user.model';
import { AppError } from '../helpers/AppError';
import Session from '../models/session.model';
import { countActiveOwnedGroups, getEffectivePlan } from '../helpers/planLimits';
import { BCRYPT_SALT_ROUNDS, type Plan } from '../config/constants';
import { generateApiKey, apiKeyPrefixOf } from '../helpers/apiKey';

export const getUserByIdService = async (userId: mongoose.Types.ObjectId) => {
    const user = await User.findById(userId).select(
        '_id name email role status createdAt apiKeyPrefix apiKeyCreatedAt'
    );
    if (!user) throw new AppError('User not found', 404);

    // No `subscription` here by design: plans belong to groups, so there is no
    // account-level entitlement to report. UI gating reads the plan off whichever
    // group it is rendering (GET /group/:id → `subscription`).
    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        // Account creation date — powers the "Member since" line on the profile.
        createdAt: user.createdAt,
        // Masked API-key view for the profile "Developer" section. Never the
        // plaintext (only returned once at generation) and never the hash.
        apiKey: user.apiKeyPrefix
            ? { prefix: user.apiKeyPrefix, createdAt: user.apiKeyCreatedAt }
            : null,
    };
};

// Issues a fresh personal API key. Only the bcrypt hash + plaintext prefix are
// stored; the full plaintext is returned ONCE here and never recoverable after.
// Re-generating overwrites any existing key (so the previous one stops working).
export const generateApiKeyService = async (
    userId: mongoose.Types.ObjectId
): Promise<{ apiKey: string; prefix: string; createdAt: Date }> => {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const apiKey = generateApiKey();
    const createdAt = new Date();

    user.apiKey = await bcrypt.hash(apiKey, BCRYPT_SALT_ROUNDS);
    user.apiKeyPrefix = apiKeyPrefixOf(apiKey);
    user.apiKeyCreatedAt = createdAt;
    await user.save();

    return { apiKey, prefix: user.apiKeyPrefix, createdAt };
};

// Clears the user's API key. Idempotent — revoking when none exists is a no-op.
export const revokeApiKeyService = async (userId: mongoose.Types.ObjectId): Promise<void> => {
    await User.updateOne(
        { _id: userId },
        { $set: { apiKey: null, apiKeyPrefix: null, apiKeyCreatedAt: null } }
    );
};

// Self-service account deletion. A SUPER_ADMIN of any still-open group is blocked
// — those groups (and their pooled balances) would be orphaned — so the user must
// close or hand them over first. Otherwise the account is marked DELETED (login is
// already refused for that status), every session is revoked, and the user is
// dropped from the groups they were a member of.
export const deleteAccountService = async (
    userId: mongoose.Types.ObjectId | string
): Promise<void> => {
    const user = await User.findById(userId);
    if (!user || user.status === 'DELETED') throw new AppError('User not found', 404);

    const ownedActiveGroups = await countActiveOwnedGroups(userId);
    if (ownedActiveGroups > 0) {
        throw new AppError(
            'Close or hand over the groups you own before deleting your account.',
            400
        );
    }

    user.status = 'DELETED';
    await user.save();

    await Session.deleteMany({ userId: user._id });
    await GroupMember.updateMany({ userId: user._id, isDeleted: false }, { $set: { isDeleted: true } });
};

// One row of the group list behind the dashboard cards. Mirrors the $project
// below — kept explicit so the plan post-processing stays type-checked.
interface UserGroupRow {
    _id: mongoose.Types.ObjectId;
    displayId: string;
    name: string;
    status: string;
    plan?: Plan | null;
    planExpiresAt?: Date | null;
    planSnapshot?: { tier: Plan } | null;
    isFavorite: boolean;
    balance: number;
    members: string[];
    role: string;
    barLength: number;
    expenseCount: number;
    categoryCount: number;
    createdAt: string;
}

export const userGroupsService = async (userId: mongoose.Types.ObjectId) => {
    const objectUserId = new mongoose.Types.ObjectId(userId);

    const rows = await GroupMember.aggregate<UserGroupRow>([
        {
            $match: {
                userId: objectUserId,
                isDeleted: false,
            },
        },
        {
            $lookup: {
                from: 'groups',
                localField: 'groupId',
                foreignField: '_id',
                as: 'group',
            },
        },
        { $unwind: '$group' },
        {
            $lookup: {
                from: 'groupmembers',
                localField: 'group._id',
                foreignField: 'groupId',
                as: 'members',
            },
        },
        {
            // Only live expenses — soft-deleted rows must not inflate the card's
            // count (mirrors the category lookup below and the report's filter).
            $lookup: {
                from: 'expenses',
                let: { gid: '$group._id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$groupId', '$$gid'] }, isDeleted: { $ne: true } } },
                    { $project: { _id: 1 } },
                ],
                as: 'expense',
            },
        },
        {
            // Only live categories — an expense can't be created without one,
            // so the card uses this count to gate its "Add Expense" action.
            $lookup: {
                from: 'categories',
                let: { gid: '$group._id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$groupId', '$$gid'] }, isDeleted: { $ne: true } } },
                    { $project: { _id: 1 } },
                ],
                as: 'category',
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: 'members.userId',
                foreignField: '_id',
                as: 'membersuser',
            },
        },
        {
            $addFields: {
                sortBucket: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$group.status', 'CLOSED'] }, then: 2 },
                            { case: { $eq: ['$isFavorite', true] }, then: 0 },
                        ],
                        default: 1,
                    },
                },
                recencyAt: { $ifNull: ['$group.updatedAt', '$group.createdAt'] },
            },
        },
        { $sort: { sortBucket: 1, recencyAt: -1 } },
        {
            $project: {
                _id: '$group._id',
                displayId: '$group.displayId',
                name: '$group.name',
                status: '$group.status',
                // The group's own stored subscription — every card badges the tier
                // that group actually holds, not the viewer's.
                plan: '$group.plan',
                planExpiresAt: '$group.planExpiresAt',
                // Frozen plan captured at close — lets the card badge the group's
                // historical tier even after that plan lapses. null for open groups.
                planSnapshot: '$group.planSnapshot',
                isFavorite: { $ifNull: ['$isFavorite', false] },
                balance: { $divide: ['$group.balance', 100] },
                members: {
                    $map: {
                        input: '$membersuser',
                        as: 'u',
                        in: '$$u.name',
                    },
                },
                role: {
                    $first: {
                        $map: {
                            input: {
                                $filter: {
                                    input: '$members',
                                    as: 'm',
                                    cond: { $eq: ['$$m.userId', objectUserId] },
                                },
                            },
                            as: 'm',
                            in: '$$m.role',
                        },
                    },
                },
                // Percentage of the pool still remaining (balance ÷ contribution),
                // clamped to 0–100 so a negative or over-refunded balance can't
                // produce an out-of-range bar.
                barLength: {
                    $cond: [
                        { $gt: ['$group.totalContribution', 0] },
                        {
                            $max: [
                                0,
                                {
                                    $min: [
                                        100,
                                        {
                                            $round: [
                                                {
                                                    $multiply: [
                                                        {
                                                            $divide: [
                                                                '$group.balance',
                                                                '$group.totalContribution',
                                                            ],
                                                        },
                                                        100,
                                                    ],
                                                },
                                                0,
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        0,
                    ],
                },
                expenseCount: { $size: '$expense' },
                categoryCount: { $size: '$category' },
                createdAt: {
                    $dateToString: {
                        format: '%d %b %Y',
                        date: '$group.createdAt',
                    },
                },
            },
        },
    ]);

    // Resolve each group's EFFECTIVE tier in Node rather than re-expressing the
    // expiry/grace branching as aggregation stages: this is one user's
    // memberships, so the set is small, and reusing getEffectivePlan is what
    // guarantees the badge can't drift from what the write gates enforce.
    // A closed group reports its frozen snapshot, matching getGroupPlan.
    return rows.map((g) => ({
        ...g,
        planTier:
            g.status === 'CLOSED' && g.planSnapshot?.tier
                ? g.planSnapshot.tier
                : getEffectivePlan({ plan: g.plan, planExpiresAt: g.planExpiresAt }).tier,
    }));
};

export const searchUsersService = async (
    query: string,
    currentUserId: mongoose.Types.ObjectId
) => {
    if (!query || query.trim().length < 2) return [];

    const safe = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');

    return User.find({
        $or: [{ email: { $regex: regex } }, { name: { $regex: regex } }],
        _id: { $ne: currentUserId },
    })
        .select('_id name email')
        .limit(6)
        .lean();
};

export const verifyUserService = async (email: string) => {
    const user = await User.findOne({ email }).select('_id name email');
    if (!user) throw new AppError('User not found', 404);
    return user;
};
