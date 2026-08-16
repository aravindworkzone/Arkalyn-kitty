import express from 'express';
import { z } from 'zod';
import { exportGroupCsv } from '../controllers/export.controller';
import { verifyToken, loadGroup, authorizeRole } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { groupIdParamSchema } from '../validators/common';

const router = express.Router();

const exportParamsSchema = z.object({
    groupId: groupIdParamSchema,
    sheet: z.enum(['ledger', 'expenses', 'members', 'audit-pack']),
});

// Admins only, unlike the reports a MEMBER can read. An export is the whole
// group's financial record — every member's contribution, every settlement
// amount, every email — in one portable file. Reading a chart in-app and walking
// away with the roster are different acts, and only the people accountable for
// the group's books should be able to do the second.
router.get(
    '/:groupId/:sheet',
    validate({ params: exportParamsSchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    exportGroupCsv
);

export default router;
