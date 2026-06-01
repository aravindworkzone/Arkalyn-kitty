import mongoose from 'mongoose';
import GroupMember from '../models/group_member.model';
import User from '../models/user.model';
import { AppError } from '../helpers/AppError';
import { getEffectivePlan, toPlanView } from '../helpers/planLimits';

export const getUserByIdService = async (userId: mongoose.Types.ObjectId) => {
    const user = await User.findById(userId).select('_id name email role status plan planExpiresAt');
    if (!user) throw new AppError('User not found', 404);

    // Attach the effective subscription (tier/status/limits/features) so the
    // frontend can gate UI from the single /user/me call.
    const subscription = toPlanView(getEffectivePlan({ plan: user.plan, planExpiresAt: user.planExpiresAt }));

    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        subscription,
    };
};

export const userGroupsService = async (userId: mongoose.Types.ObjectId) => {
    const objectUserId = new mongoose.Types.ObjectId(userId);

    return GroupMember.aggregate([
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
            $lookup: {
                from: 'expenses',
                localField: 'group._id',
                foreignField: 'groupId',
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
