import mongoose from 'mongoose';
import Category from '../models/category.model';
import GroupEvent from '../models/group_event.model';
import Expense from '../models/expense.model';
import { AppError } from '../helpers/AppError';
import { getGroupOwnerPlan, assertWithinLimit } from '../helpers/planLimits';

export const createCategoryService = async (data: {
    name: string;
    groupId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    color?: string;
}) => {
    const { groupId, userId, name, color } = data;

    // Collapse internal whitespace so "test  name" and "test name" can't both
    // exist — the { groupId, name } unique index only catches exact matches.
    const cleanName = name.replace(/\s+/g, ' ').trim();

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const existing = await Category.findOne({ groupId, name: cleanName, isDeleted: false }).session(session);
        if (existing) throw new AppError('Category already exists', 409);

        // Subscription gate: cap categories per group on the owner's tier.
        const ownerPlan = await getGroupOwnerPlan(groupId, session);
        const categoryCount = await Category.countDocuments({ groupId, isDeleted: false }).session(session);
        assertWithinLimit(
            categoryCount,
            ownerPlan.limits.maxCategoriesPerGroup,
            `This group has reached its ${ownerPlan.config.name}-plan category limit (${ownerPlan.limits.maxCategoriesPerGroup}). The group owner can upgrade to add more.`
        );

        const categorySave = new Category({ name: cleanName, groupId, color });
        await categorySave.save({ session });

        const event = await GroupEvent.create(
            [{
                groupId,
                performedBy: userId,
                eventType: "MANAGE_CATEGORY",
                metadata: { userId, note: `Created category: ${cleanName}` },
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

export const updateCategoryService = async (data: {
    categoryId: string;
    groupId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    color?: string;
    isSpecial?: boolean;
}) => {
    const { categoryId, groupId, userId, color, isSpecial } = data;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const category = await Category.findOne({ _id: categoryId, groupId, isDeleted: false }).session(session);
        if (!category) throw new AppError('Category not found', 404);

        const changes: string[] = [];
        if (color !== undefined && color !== category.color) {
            changes.push(`colour ${category.color} → ${color}`);
            category.color = color;
        }
        if (isSpecial !== undefined && isSpecial !== Boolean(category.isSpecial)) {
            changes.push(isSpecial ? "marked collective" : "unmarked collective");
            category.isSpecial = isSpecial;
        }

        await category.save({ session });

        const event = await GroupEvent.create(
            [{
                groupId,
                performedBy: userId,
                eventType: "MANAGE_CATEGORY",
                metadata: {
                    userId,
                    note: changes.length
                        ? `Updated category "${category.name}" (${changes.join(", ")})`
                        : `Updated category "${category.name}"`,
                },
                referenceId: category._id,
                referenceModel: "Category",
            }],
            { session }
        );

        await session.commitTransaction();
        return { category, event };
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
    const categories = await Category.find({ groupId, isDeleted: false })
        .select('_id name color isSpecial')
        .sort({ createdAt: -1 })
        .lean();

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
            isSpecial: Boolean(c.isSpecial),
            expenseCount: countMap.get(c._id.toString()) ?? 0,
        }))
        .sort((a, b) => b.expenseCount - a.expenseCount);
};
