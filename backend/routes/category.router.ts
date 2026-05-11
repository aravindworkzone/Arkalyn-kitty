import express from 'express';
import { createCategory, deleteCategory, getCategoryDetails } from '../controllers/category.controller';
import { verifyToken, authorizeRole, loadGroup } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createCategoryBodySchema,
    deleteCategoryParamsSchema,
    getCategoryParamsSchema,
} from '../validators/category.validator';

const router = express.Router();

router.post(
    '/create',
    validate({ body: createCategoryBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    createCategory
);

router.delete(
    '/delete/:id/:groupId',
    validate({ params: deleteCategoryParamsSchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    deleteCategory
);

router.get(
    '/getCategoryDetails/:groupId',
    validate({ params: getCategoryParamsSchema }),
    verifyToken,
    loadGroup,
    getCategoryDetails
);

export default router;
