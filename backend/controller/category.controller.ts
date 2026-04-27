import { createCategoryService, deleteCategoryService, getCategoryDetailsService } from '../Service/category.service';
import { Request, Response } from 'express';

export const createCategory = async (req: Request, res: Response) => {
    if (!req.group) return res.status(400).json({ message: "Group not found" });
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const name = typeof req.body.name === "string" ? req.body.name.trim() : null;

    try {
        const result = await createCategoryService({ 
            name, 
            groupId: req.group._id, 
            userId: req.user._id 
        });
        return res.status(201).json({ 
            message: "Category created", 
            category: result.category, 
            event: result.event 
        });
    } catch (error: any) {
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: error.message || 'Error creating category' });
    }
}

export const deleteCategory = async (req: Request, res: Response) => {
    if (!req.group) return res.status(400).json({ message: "Group not found" });
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const categoryId = req.params.id as string;
    try {
        const category = await deleteCategoryService({ categoryId, groupId: req.group._id, userId: req.user._id });
        return res.status(200).json({ message: "Category deleted", category });
    } catch (error: any) {
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: 'Error deleting category', error: error.message });
    }
}

export const getCategoryDetails = async (req: Request, res: Response) => {
    if (!req.group?._id) return res.status(400).json({ message: "Group not found" });
    try {
        const category = await getCategoryDetailsService(req.group._id);
        return res.status(200).json({ message: "Category deleted", category });
    } catch (error: any) {
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ message: 'Error deleting category', error: error.message });
    }
}