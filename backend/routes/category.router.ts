import express from 'express';
import { createCategory, updateCategory, deleteCategory, getCategoryDetails } from '../controllers/category.controller';
import { verifyToken, authorizeRole, loadGroup, ensureGroupActive } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createCategoryBodySchema,
    updateCategoryParamsSchema,
    updateCategoryBodySchema,
    deleteCategoryParamsSchema,
    getCategoryParamsSchema,
    getCategoryQuerySchema,
} from '../validators/category.validator';

const router = express.Router();

router.post(
    '/create',
    validate({ body: createCategoryBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    createCategory
);

router.patch(
    '/update/:id',
    validate({ params: updateCategoryParamsSchema, body: updateCategoryBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    updateCategory
);

router.delete(
    '/delete/:id/:groupId',
    validate({ params: deleteCategoryParamsSchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    deleteCategory
);

router.get(
    '/getCategoryDetails/:groupId',
    validate({ params: getCategoryParamsSchema, query: getCategoryQuerySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    getCategoryDetails
);

export default router;
