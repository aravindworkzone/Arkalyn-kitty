import mongoose from 'mongoose';
import Category from '../Model/category.model';
import GroupEvent from '../Model/group_event.model';
import { AppError } from '../Utils/AppError';

export const createCategoryService = async (data: { name: string; groupId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId }) => {
    const groupId = data.groupId;
    const userId = data.userId;
    const name = typeof data.name === "string" ? data.name.trim() : null;

    if (!groupId || !name) {
        throw AppError("All fields are required", 400);
    }

    if (name.length < 3 || name.length > 50) {
        throw AppError("Name must be between 3 and 50 characters", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const categorySave = new Category({
            name,
            groupId: groupId
        });
        await categorySave.save({ session });

        const event = await GroupEvent.create([{
            groupId: groupId,
            performedBy: userId,
            eventType: "MANAGE_CATEGORY",
            metadata: { userId: userId, note: `Created category: ${name}` },
            referenceId: categorySave._id,
            referenceModel: "category"
        }], { session });

        await session.commitTransaction();
        return { category: categorySave, event };
    } catch (error: any) {
        await session.abortTransaction();
        if (error.code === 11000) {
            throw AppError('Category already exists in this group', 409);
        }
        throw AppError('Error creating category', 500);
    } finally {
        session.endSession();
    }
}

export const deleteCategoryService = async (data: { categoryId: string, groupId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId }) => {
    const categoryId = new mongoose.Types.ObjectId(data.categoryId);

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw AppError("Invalid category ID format", 400);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const category = await Category.findByIdAndDelete(categoryId, { session });

        await GroupEvent.create([{
            groupId: data.groupId,
            performedBy: data.userId,
            eventType: "MANAGE_CATEGORY",
            metadata: { userId: data.userId, note: `Deleted category: ${category!.name}` },
            referenceId: categoryId,
            referenceModel: "category"
        }], { session });

        await session.commitTransaction();

        if (!category) {
            throw AppError('Category not found', 404);
        }

        return category;
    } catch (error: any) {
        await session.abortTransaction();
        const statusCode = error.status || 500;
        throw AppError('Error deleting category', statusCode);
    } finally {
        session.endSession();
    }
}