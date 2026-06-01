import express from 'express';
import { categoryBreakdown, memberBreakdown, spendTrend } from '../controllers/report.controller';
import { verifyToken, loadGroup, authorizeRole } from '../middlewares/auth.middleware';
import { requireAdvancedReportRange } from '../middlewares/plan.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    categoryBreakdownParamsSchema,
    categoryBreakdownQuerySchema,
    reportRangeParamsSchema,
    reportRangeQuerySchema,
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
    requireAdvancedReportRange,
    categoryBreakdown
);

router.get(
    '/:groupId/reports/member-breakdown',
    validate({
        params: reportRangeParamsSchema,
        query: reportRangeQuerySchema,
    }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    requireAdvancedReportRange,
    memberBreakdown
);

router.get(
    '/:groupId/reports/spend-trend',
    validate({
        params: reportRangeParamsSchema,
        query: reportRangeQuerySchema,
    }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    requireAdvancedReportRange,
    spendTrend
);

export default router;
