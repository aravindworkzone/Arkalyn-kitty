import mongoose from "mongoose";
import GroupMember from "../Model/group_member.model";
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
                $project: {
                    _id: "$group._id",
                    displayId: "$group.displayId",
                    name: "$group.name",
                    balance: "$group.balance",
                    members: "$members.userId",
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
                    createdAt: "$group.createdAt"
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