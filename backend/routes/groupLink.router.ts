import express from 'express';
import {
    requestLink,
    approveLink,
    rejectLink,
    transferToLink,
    revokeLink,
    getGroupLinks,
} from '../controllers/groupLink.controller';
import {
    verifyToken,
    loadGroup,
    authorizeRole,
    ensureGroupActive,
} from '../middlewares/auth.middleware';
import { requireGroupLinking } from '../middlewares/plan.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    requestLinkBodySchema,
    reviewLinkBodySchema,
    transferBodySchema,
    groupLinksParamsSchema,
} from '../validators/groupLink.validator';

const router = express.Router();

// Every route below resolves exactly ONE group via loadGroup — always the group
// whose admin is acting. /request is authorized against the HOST (the group
// asking to be funded); /approve, /reject and /transfer against the SOURCE (the
// group whose money it is). That split is what lets the standard middleware
// chain express this feature without touching loadGroup or authorizeRole.

router.post(
    '/request',
    validate({ body: requestLinkBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    requireGroupLinking,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    requestLink
);

router.post(
    '/approve',
    validate({ body: reviewLinkBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    requireGroupLinking,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    approveLink
);

router.post(
    '/reject',
    validate({ body: reviewLinkBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    requireGroupLinking,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    rejectLink
);

router.post(
    '/transfer',
    validate({ body: transferBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    requireGroupLinking,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    transferToLink
);

// Ungated by plan: a lapsed plan must still be able to unwind links it already
// has, and a closed group needs tearing down too — hence no ensureGroupActive.
router.post(
    '/revoke',
    validate({ body: reviewLinkBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    revokeLink
);

// Read stays free on every tier so an expired plan can still see its links.
router.get(
    '/:groupId',
    validate({ params: groupLinksParamsSchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    getGroupLinks
);

export default router;
