import express from 'express';
import {
    createJoinLink,
    getJoinLink,
    revokeJoinLink,
    previewJoinLink,
    joinViaLink,
} from '../controllers/joinLink.controller';
import {
    verifyToken,
    loadGroup,
    authorizeRole,
    ensureGroupActive,
} from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    joinLinkGroupBodySchema,
    joinLinkGroupParamsSchema,
    joinLinkTokenParamsSchema,
    joinViaLinkBodySchema,
} from '../validators/joinLink.validator';

const router = express.Router();

// ── Managing the link: group-scoped, admins only ──────────────────────────────

router.post(
    '/create',
    validate({ body: joinLinkGroupBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    createJoinLink
);

router.post(
    '/revoke',
    validate({ body: joinLinkGroupBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    revokeJoinLink
);

router.get(
    '/group/:groupId',
    validate({ params: joinLinkGroupParamsSchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    getJoinLink
);

// ── Using the link: any signed-in user, no membership required ────────────────
//
// These deliberately skip loadGroup/authorizeRole — the whole point is that the
// caller is NOT yet in the group. The token is the authorization to ask, and the
// service re-checks the group's state, the caller's standing and the plan cap.
// They still sit behind verifyToken: an anonymous visitor is sent to log in
// first, so a request always has a real account attached to it.

router.get(
    '/preview/:token',
    validate({ params: joinLinkTokenParamsSchema }),
    verifyToken,
    previewJoinLink
);

router.post('/join', validate({ body: joinViaLinkBodySchema }), verifyToken, joinViaLink);

export default router;
