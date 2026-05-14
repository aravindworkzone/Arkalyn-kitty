import express from 'express';
import {
    createGroup,
    deleteGroup,
    manageMember,
    inviteMember,
    manageAdmin,
    addContribution,
    Settlement,
    leaveGroup,
    approveLeaveRequest,
    rejectLeaveRequest,
    getGroupById,
    getGroupMember,
    getBasicTransaction,
    getTransaction,
    getAllCredits,
    getEvent,
} from '../controllers/group.controller';
import { verifyToken, authorizeRole, loadGroup } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createGroupBodySchema,
    groupIdParamObject,
    manageMemberBodySchema,
    inviteMemberBodySchema,
    manageAdminBodySchema,
    addContributionBodySchema,
    settlementBodySchema,
    leaveGroupBodySchema,
    approveLeaveBodySchema,
    rejectLeaveBodySchema,
} from '../validators/group.validator';

const router = express.Router();

router.post(
    '/create',
    validate({ body: createGroupBodySchema }),
    verifyToken,
    createGroup
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
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    manageMember
);

router.post(
    '/invitemember',
    validate({ body: inviteMemberBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    inviteMember
);

router.post(
    '/manageadmin',
    validate({ body: manageAdminBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN'),
    manageAdmin
);

router.post(
    '/addcontribution',
    validate({ body: addContributionBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    addContribution
);

router.post(
    '/settlement',
    validate({ body: settlementBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    Settlement
);

router.post(
    '/leave',
    validate({ body: leaveGroupBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('ADMIN', 'MEMBER'),
    leaveGroup
);

router.post(
    '/leave/approve',
    validate({ body: approveLeaveBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    approveLeaveRequest
);

router.post(
    '/leave/reject',
    validate({ body: rejectLeaveBodySchema }),
    verifyToken,
    loadGroup,
    authorizeRole('SUPER_ADMIN', 'ADMIN'),
    rejectLeaveRequest
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
    '/getbasictransaction/:groupId',
    validate({ params: groupIdParamObject }),
    verifyToken,
    loadGroup,
    getBasicTransaction
);

router.get(
    '/getTransaction/:groupId',
    validate({ params: groupIdParamObject }),
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
    validate({ params: groupIdParamObject }),
    verifyToken,
    loadGroup,
    getAllCredits
);

export default router;
