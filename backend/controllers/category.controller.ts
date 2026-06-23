import { createCategoryService, updateCategoryService, deleteCategoryService, getCategoryDetailsService } from '../services/category.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AppError } from '../helpers/AppError';
import { emitToGroup } from '../sockets';
import { SOCKET_EVENTS } from '../sockets/events';

export const createCategory = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const type = req.body.type === 'CREDIT' ? 'CREDIT' : 'EXPENSE';

    const result = await createCategoryService({
        name,
        groupId: req.group._id,
        userId: req.user._id,
        color: req.body.color,
        type,
    });

    emitToGroup(req.group.displayId.toString(), SOCKET_EVENTS.CATEGORY_CREATED);

    sendCreated(res, { category: result.category, event: result.event }, 'Category created');
});

export const updateCategory = asyncHandler(async (req, res) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);
    if (!req.user?._id) throw new AppError('Unauthorized', 401);

    const result = await updateCategoryService({
        categoryId: req.params.id as string,
        groupId: req.group._id,
        userId: req.user._id,
        color: typeof req.body.color === 'string' ? req.body.color : undefined,
        isSpecial: typeof req.body.isSpecial === 'boolean' ? req.body.isSpecial : undefined,
    });

    emitToGroup(req.group.displayId.toString(), SOCKET_EVENTS.CATEGORY_UPDATED);

    sendSuccess(res, { category: result.category, event: result.event }, 'Category updated');
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

    const type = req.query.type === 'CREDIT' ? 'CREDIT' : 'EXPENSE';
    const categories = await getCategoryDetailsService(req.group._id, type);
    sendSuccess(res, { categories }, 'Categories fetched');
});
