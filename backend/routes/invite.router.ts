import express from 'express';
import {
    acceptInvite,
    rejectInvite,
    approveJoin,
    declineJoin,
    getPendingJoinRequests,
} from '../controllers/invite.controller';
import { verifyToken, loadGroup, authorizeRole, ensureGroupActive } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    acceptInviteBodySchema,
    rejectInviteBodySchema,
    reviewJoinBodySchema,
    pendingJoinParamsSchema,
} from '../validators/invite.validator';

const router = express.Router();

router.post('/accept', validate({ body: acceptInviteBodySchema }), verifyToken, acceptInvite);

router.post('/reject', validate({ body: rejectInviteBodySchema }), verifyToken, rejectInvite);

// Admitting a member is an admin action, so these three sit behind the group's
// role gate rather than the invitee's own identity check.
router.post(
    '/approve',
    validate({ body: reviewJoinBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    approveJoin
);

router.post(
    '/decline',
    validate({ body: reviewJoinBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    declineJoin
);

router.get(
    '/pending/:groupId',
    validate({ params: pendingJoinParamsSchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    getPendingJoinRequests
);

export default router;
