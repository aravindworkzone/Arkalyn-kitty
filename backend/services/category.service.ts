import mongoose from 'mongoose';
import Category from '../models/category.model';
import GroupEvent from '../models/group_event.model';
import Expense from '../models/expense.model';
import { AppError } from '../helpers/AppError';

export const createCategoryService = async (data: {
    name: string;
    groupId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    color?: string;
}) => {
    const { groupId, userId, name, color } = data;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const categorySave = new Category({ name, groupId, color });
        await categorySave.save({ session });

        const event = await GroupEvent.create(
            [{
                groupId,
                performedBy: userId,
                eventType: "MANAGE_CATEGORY",
                metadata: { userId, note: `Created category: ${name}` },
                referenceId: categorySave._id,
                referenceModel: "Category",
            }],
            { session }
        );

        await session.commitTransaction();
        return { category: categorySave, event };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const deleteCategoryService = async (data: {
    categoryId: string;
    userId: mongoose.Types.ObjectId;
    groupId: mongoose.Types.ObjectId;
}) => {
    const categoryId = new mongoose.Types.ObjectId(data.categoryId);

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const category = await Category.findByIdAndDelete(categoryId, { session });
        if (!category) throw new AppError('Category not found', 404);

        await GroupEvent.create(
            [{
                groupId: data.groupId,
                performedBy: data.userId,
                eventType: "MANAGE_CATEGORY",
                metadata: { userId: data.userId, note: `Deleted category: ${category.name}` },
                referenceId: categoryId,
                referenceModel: "Category",
            }],
            { session }
        );

        await session.commitTransaction();
        return category;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export const getCategoryDetailsService = async (groupId: mongoose.Types.ObjectId) => {
    const categories = await Category.find({ groupId, isDeleted: false }).select('_id name color').lean();

    const counts = await Expense.aggregate([
        {
            $match: {
                category: { $in: categories.map((c) => c._id) },
                isDeleted: false,
            },
        },
        { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>(
        counts.map((c) => [c._id.toString(), c.count])
    );

    return categories
        .map((c) => ({
            _id: c._id,
            name: c.name,
            color: c.color,
            expenseCount: countMap.get(c._id.toString()) ?? 0,
        }))
        .sort((a, b) => b.expenseCount - a.expenseCount);
};
