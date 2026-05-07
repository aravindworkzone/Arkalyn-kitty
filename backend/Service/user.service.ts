import mongoose from "mongoose";
import GroupMember from "../Model/group_member.model";
import User from "../Model/user.model";
import {AppError} from "../Helper/AppError";
export const userGroupsService = async (userId: mongoose.Types.ObjectId) => {
    try {

        const objectUserId = new mongoose.Types.ObjectId(userId);

        const userGroups = await GroupMember.aggregate([
        {
            $match: {
            userId: objectUserId,
            isDeleted: false
            }
        },
        {
            $lookup: {
            from: "groups",
            localField: "groupId",
            foreignField: "_id",
            as: "group"
            }
        },
        { $unwind: "$group" },
        {
            $lookup: {
            from: "groupmembers",
            localField: "group._id",
            foreignField: "groupId",
            as: "members"
            }
        },
        {
            $lookup: {
            from: "expenses",
            localField: "group._id",
            foreignField: "groupId",
            as: "expense"
            }
        },
        {
            $lookup: {
            from: "users",
            localField: "members.userId",
            foreignField: "_id",
            as: "membersuser"
            }
        },
        { $sort: { "group.createdAt": -1 } },
        {
            $project: {
            _id: "$group._id",
            displayId: "$group.displayId",
            name: "$group.name",
            balance: { $divide: ["$group.balance", 100] },

            members: {
                $map: {
                input: "$membersuser",
                as: "u",
                in: "$$u.name"
                }
            },

            role: {
                $first: {
                $map: {
                    input: {
                    $filter: {
                        input: "$members",
                        as: "m",
                        cond: { $eq: ["$$m.userId", objectUserId] }
                    }
                    },
                    as: "m",
                    in: "$$m.role"
                }
                }
            },

            barLength: {
                $cond: [
                { $gt: ["$group.totalContribution", 0] },
                {
                    $round: [
                    {
                        $multiply: [
                        {
                            $subtract: [
                            1,
                            {
                                $divide: [
                                "$group.balance",
                                "$group.totalContribution"
                                ]
                            }
                            ]
                        },
                        100
                        ]
                    },
                    0
                    ]
                },
                0
                ]
            },

            expenseCount: { $size: "$expense" },

            createdAt: {
                $dateToString: {
                format: "%d %b %Y",
                date: "$group.createdAt"
                }
            }
            }
        }
        ]);

        return userGroups;

    } catch (error: any) {
        const message = error.message || 'Internal server error';
        const statusCode = error.status || 500;
        throw AppError(message , statusCode);
    }
};

export const searchUsersService = async (query: string, currentUserId: mongoose.Types.ObjectId) => {
    if (!query || query.trim().length < 2) return [];
    const safe = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");
    return User.find({
        $or: [{ email: { $regex: regex } }, { name: { $regex: regex } }],
        _id: { $ne: currentUserId },
    })
        .select("_id name email")
        .limit(6)
        .lean();
};

export const verifyUserService = async (email: string) => {
    try {
        if(!email){
            throw AppError('Email is required', 400);
        }
        const user = await User.findOne({ email });
        if(!user){
            throw AppError('User not found', 404);
        }
        return user;
    } catch (error: any) {
        const message = error.message || 'Internal server error';
        const statusCode = error.status || 500;
        throw AppError(message , statusCode);
    }
};