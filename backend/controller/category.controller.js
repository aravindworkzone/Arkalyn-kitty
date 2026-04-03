const Category = require('../model/category.model');
const mongoose = require("mongoose");

exports.createCategory = async (req, res) => {
    try {
        const groupId = typeof req.body.groupId === "string" ? req.body.groupId.trim() : null;
        const name = typeof req.body.name === "string" ? req.body.name.trim() : null;

        if (!groupId  || !name) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (name.length < 3 || name.length > 50) {
            return res.status(400).json({ message: "Name must be between 3 and 50 characters" });
        }

        const category = { name };

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }

        category.groupId = groupId;

        const categorySave = new Category(category);
        await categorySave.save();

        res.status(201).json({ message: "Category created", categorySave });
    } catch (error) {
        res.status(500).json({ message: 'Error creating category', error });
        console.error('Error creating category:', error);
    }
}

exports.deleteCategory = async (req, res) => {
    try {
        const categoryId = req.body.id;

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: "Invalid category ID format" });
        }

        const category = await Category.findByIdAndDelete(categoryId);

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        res.status(200).json({ message: "Category deleted", category });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting category', error: error.message });
        console.error('Error deleting category:', error);
    }
}