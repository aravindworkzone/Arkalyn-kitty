import { createCategoryService, deleteCategoryService, getCategoryDetailsService } from '../services/category.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AppError } from '../helpers/AppError';
import { emitToGroup } from '../sockets';
import { SOCKET_EVENTS } from '../sockets/events';

export const createCategory = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    const result = await createCategoryService({
        name,
        groupId: req.group._id,
        userId: req.user._id,
        color: req.body.color,
    });

    emitToGroup(req.group.displayId.toString(), SOCKET_EVENTS.CATEGORY_CREATED);

    sendCreated(res, { category: result.category, event: result.event }, 'Category created');
});

export const deleteCategory = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const category = await deleteCategoryService({
        categoryId: req.params.id as string,
        userId: req.user._id,
        groupId: req.group._id,
    });

    emitToGroup(req.group.displayId.toString(), SOCKET_EVENTS.CATEGORY_DELETED);

    sendSuccess(res, { category }, 'Category deleted');
});

export const getCategoryDetails = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const categories = await getCategoryDetailsService(req.group._id);
    sendSuccess(res, { categories }, 'Categories fetched');
});
