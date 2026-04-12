const Category = require('../model/category.model');
const mongoose = require("mongoose");
const GroupEvent = require('../model/group_event.model');

exports.createCategory = async (req, res) => {
    const groupData = req.group;
    const name = typeof req.body.name === "string" ? req.body.name.trim() : null;

    if (!groupData._id  || !name) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (name.length < 3 || name.length > 50) {
        return res.status(400).json({ message: "Name must be between 3 and 50 characters" });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const categorySave = new Category({
            name,
            groupId: groupData._id
        });
        await categorySave.save({ session });

        const event = await GroupEvent.create([{
            groupId: groupData._id,
            performedBy: req.user._id,
            eventType: "MANAGE_CATEGORY",
            metadata: { userId: req.user._id, note: `Created category: ${name}` },
            referenceId: categorySave._id,
            referenceModel: "category"
        }], { session });

        await session.commitTransaction();
        return res.status(201).json({ message: "Category created", categorySave, event });
    } catch (error) {
        await session.abortTransaction();
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Category already exists in this group' });
        }
        return res.status(500).json({ message: 'Error creating category', error: error.status });
    } finally {
        session.endSession();
    }
}

exports.deleteCategory = async (req, res) => {
    const categoryId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID format" });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const category = await Category.findByIdAndDelete(categoryId, { session });

        await GroupEvent.create([{
            groupId: req.group._id,
            performedBy: req.user._id,
            eventType: "MANAGE_CATEGORY",
            metadata: { userId: req.user._id, note: `Deleted category: ${category.name}` },
            referenceId: category._id,
            referenceModel: "category"
        }], { session });

        await session.commitTransaction();

        if (!category) {
            throw Object.assign(new Error('Category not found'), { status: 404 });
        }

        res.status(200).json({ message: "Category deleted", category });
    } catch (error) {
        await session.abortTransaction();
        const statusCode = error.status || 500;
        res.status(statusCode).json({ message: 'Error deleting category', error: error.message });
        console.error('Error deleting category:', error);
    } finally {
        session.endSession();
    }
}