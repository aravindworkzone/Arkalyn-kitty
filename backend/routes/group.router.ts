import express from 'express';
import {
    createGroup,
    cloneGroup,
    deleteGroup,
    manageMember,
    inviteMember,
    manageAdmin,
    addContribution,
    Settlement,
    leaveGroup,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelOwnLeaveRequest,
    getGroupById,
    getGroupMember,
    getLeftContributors,
    getBasicTransaction,
    getTransaction,
    getAllCredits,
    removeCredit,
    getEvent,
    toggleFavorite,
} from '../controllers/group.controller';
import { verifyToken, authorizeRole, loadGroup, ensureGroupActive } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createGroupBodySchema,
    cloneGroupBodySchema,
    groupIdParamObject,
    manageMemberBodySchema,
    inviteMemberBodySchema,
    manageAdminBodySchema,
    addContributionBodySchema,
    settlementBodySchema,
    leaveGroupBodySchema,
    approveLeaveBodySchema,
    rejectLeaveBodySchema,
    cancelOwnLeaveBodySchema,
    toggleFavoriteBodySchema,
    removeCreditParamsSchema,
    removeCreditBodySchema,
} from '../validators/group.validator';
import { closeGroupBodySchema } from '../validators/groupClose.validator';
import { paginationQuerySchema } from '../validators/common';
import { getGroupClosePreview, closeGroup } from '../controllers/groupClose.controller';

const router = express.Router();

router.post(
    '/create',
    validate({ body: createGroupBodySchema }),
    verifyToken,
    createGroup
);

router.post(
    // Cloning is allowed on CLOSED groups too — it only reads the source's
    // structure and creates a brand-new group, never mutating the closed one.
    // (The clone service still gates the feature on the source's frozen plan.)
    '/:groupId/clone',
    validate({ params: groupIdParamObject, body: cloneGroupBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN'),
    cloneGroup
);

router.delete(
    '/delete/:groupId',
    validate({ params: groupIdParamObject }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN'),
    deleteGroup
);

router.post(
    '/managemember',
    validate({ body: manageMemberBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    manageMember
);

router.post(
    '/invitemember',
    validate({ body: inviteMemberBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    inviteMember
);

router.post(
    '/manageadmin',
    validate({ body: manageAdminBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN'),
    manageAdmin
);

router.post(
    '/addcontribution',
    validate({ body: addContributionBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    addContribution
);

router.post(
    '/settlement',
    validate({ body: settlementBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    Settlement
);

router.post(
    '/leave',
    validate({ body: leaveGroupBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('ADMIN', 'MEMBER'),
    leaveGroup
);

router.post(
    '/leave/approve',
    validate({ body: approveLeaveBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    approveLeaveRequest
);

router.post(
    '/leave/reject',
    validate({ body: rejectLeaveBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    rejectLeaveRequest
);

router.post(
    '/leave/cancel',
    validate({ body: cancelOwnLeaveBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('ADMIN', 'MEMBER'),
    cancelOwnLeaveRequest
);

router.get(
    '/:groupId/close-preview',
    validate({ params: groupIdParamObject }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN'),
    getGroupClosePreview
);

router.post(
    '/:groupId/close',
    validate({ params: groupIdParamObject, body: closeGroupBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN'),
    closeGroup
);

router.get(
    '/getgroupbyid/:groupId',
    validate({ params: groupIdParamObject }),
    verifyToken,
    loadGroup,
    getGroupById
);

router.get(
    '/getgroupmembers/:groupId',
    validate({ params: groupIdParamObject }),
    verifyToken,
    loadGroup,
    getGroupMember
);

router.get(
    '/leftcontributors/:groupId',
    validate({ params: groupIdParamObject }),
    verifyToken,
    loadGroup,
    getLeftContributors
);

router.get(
    '/getbasictransaction/:groupId',
    validate({ params: groupIdParamObject }),
    verifyToken,
    loadGroup,
    getBasicTransaction
);

router.get(
    '/getTransaction/:groupId',
    validate({ params: groupIdParamObject, query: paginationQuerySchema }),
    verifyToken,
    loadGroup,
    getTransaction
);

router.get(
    '/getEvent/:groupId',
    validate({ params: groupIdParamObject }),
    verifyToken,
    loadGroup,
    getEvent
);

router.get(
    '/allcredits/:groupId',
    validate({ params: groupIdParamObject, query: paginationQuerySchema }),
    verifyToken,
    loadGroup,
    getAllCredits
);

router.delete(
    '/credit/:creditId',
    validate({ params: removeCreditParamsSchema, body: removeCreditBodySchema }),
    verifyToken,
    loadGroup,
    ensureGroupActive,
    authorizeRole('SUPER_ADMIN'),
    removeCredit
);

router.post(
    '/favorite',
    validate({ body: toggleFavoriteBodySchema }),
    verifyToken,
    loadGroup,
    toggleFavorite
);

export default router;
