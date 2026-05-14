import express from 'express';
import { categoryBreakdown } from '../controllers/report.controller';
import { verifyToken, loadGroup, authorizeRole } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    categoryBreakdownParamsSchema,
    categoryBreakdownQuerySchema,
} from '../validators/report.validator';

const router = express.Router();

router.get(
    '/:groupId/reports/category-breakdown',
    validate({
        params: categoryBreakdownParamsSchema,
        query: categoryBreakdownQuerySchema,
    }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    categoryBreakdown
);

export default router;
