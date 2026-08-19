import express from 'express';
import {
    createChitScheme,
    updateChitScheme,
    activateChitScheme,
    rescheduleChit,
    cancelChitScheme,
    reassignChitOrganizer,
    markChitDue,
    unmarkChitDue,
    releaseChitPayout,
    getChitBoard,
    getChitHistory,
} from '../controllers/chit.controller';
import {
    verifyToken,
    loadGroup,
    authorizeRole,
    ensureGroupActive,
} from '../middlewares/auth.middleware';
import { requireGroupTypeFeature } from '../middlewares/groupType.middleware';
import { requireChitOrganizer } from '../middlewares/chit.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createChitSchemeBodySchema,
    updateChitSchemeBodySchema,
    activateChitBodySchema,
    rescheduleChitBodySchema,
    cancelChitBodySchema,
    reassignOrganizerBodySchema,
    markDueBodySchema,
    unmarkDueBodySchema,
    releasePayoutBodySchema,
    chitBoardParamsSchema,
    chitBoardQuerySchema,
    chitHistoryQuerySchema,
} from '../validators/chit.validator';

const router = express.Router();

// Gate order, and each gate earns its place:
//
//   validate → verifyToken → loadGroup → ensureGroupActive → authorizeRole
//           → requireGroupTypeFeature('chit') → requireChitOrganizer → handler
//
// The TYPE gate runs after authorizeRole so a stranger cannot probe what kind of
// group this is. It throws 403, never 402: a Family group does not become a chit
// group by paying, so Payment Required would be a lie — and every 402 is recorded
// to paywall_hit as purchase intent, which this would poison.
//
// The ORGANIZER gate runs last and is the one that actually protects the money.
// authorizeRole('SUPER_ADMIN','ADMIN') would be meaningless here: on the Free
// plan defaultJoinRole makes every member an ADMIN, so a role check would let
// anyone mark themselves paid and pay themselves the pot.

const requireChitGroup = requireGroupTypeFeature(
    'chit',
    'This group is not a chit group. Chit funds are only available in a group created as a Chit.'
);

// ─── Setup ───────────────────────────────────────────────────────────────────

router.post(
    '/scheme',
    validate({ body: createChitSchemeBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    requireChitGroup,
    requireChitOrganizer,
    createChitScheme
);

router.patch(
    '/scheme',
    validate({ body: updateChitSchemeBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    requireChitGroup,
    requireChitOrganizer,
    updateChitScheme
);

router.post(
    '/activate',
    validate({ body: activateChitBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    requireChitGroup,
    requireChitOrganizer,
    activateChitScheme
);

router.post(
    '/reschedule',
    validate({ body: rescheduleChitBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    requireChitGroup,
    requireChitOrganizer,
    rescheduleChit
);

// Cancelling and handing over the organiser role are the group owner's calls,
// not the organiser's — an organiser who has gone quiet is exactly the case
// these exist for, so they must not require that same person to act.
router.post(
    '/cancel',
    validate({ body: cancelChitBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN'),
    requireChitGroup,
    cancelChitScheme
);

router.patch(
    '/organizer',
    validate({ body: reassignOrganizerBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN'),
    requireChitGroup,
    reassignChitOrganizer
);

// ─── Money ───────────────────────────────────────────────────────────────────

router.post(
    '/due/mark',
    validate({ body: markDueBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    requireChitGroup,
    requireChitOrganizer,
    markChitDue
);

router.post(
    '/due/unmark',
    validate({ body: unmarkDueBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    requireChitGroup,
    requireChitOrganizer,
    unmarkChitDue
);

router.post(
    '/payout',
    validate({ body: releasePayoutBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    requireChitGroup,
    requireChitOrganizer,
    releaseChitPayout
);

// ─── Reads ───────────────────────────────────────────────────────────────────

// Open to every member, and ungated by group type: a group whose chit has been
// cancelled, or which was somehow mislabelled, must still be able to read its own
// history. The payload itself is what keeps one member's payments private from
// another — see getChitBoardService.
router.get(
    '/:groupId',
    validate({ params: chitBoardParamsSchema, query: chitBoardQuerySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    getChitBoard
);

router.get(
    '/:groupId/history',
    validate({ params: chitBoardParamsSchema, query: chitHistoryQuerySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN', 'MEMBER'),
    getChitHistory
);

export default router;
