import mongoose from "mongoose";
import GroupMember from "../Model/group_member.model";
import User from "../Model/user.model";
import {AppError} from "../Utils/AppError";
export const userGroupsService = async (userId: mongoose.Types.ObjectId) => {
    try {

        const userGroups = await GroupMember.aggregate([
            {
                $match:{
                    userId: new mongoose.Types.ObjectId(userId),
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
            {
                $unwind: "$group"
            },
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
                    as: "members.user"
                }
            },
            {
                $project: {
                    _id: "$group._id",
                    displayId: "$group.displayId",
                    name: "$group.name",
                    balance: {$divide:["$group.balance",100]},
                    members: "$members.user.name",
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