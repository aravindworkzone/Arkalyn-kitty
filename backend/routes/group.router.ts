import express from 'express';
import {
    createGroup,
    deleteGroup,
    manageMember,
    manageAdmin,
    addContribution,
    Settlement,
    getGroupById,
    getGroupMember,
    getBasicTransaction,
    getTransaction,
    getEvent,
} from '../controllers/group.controller';
import { verifyToken, authorizeRole, loadGroup } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    createGroupBodySchema,
    groupIdParamObject,
    manageMemberBodySchema,
    manageAdminBodySchema,
    addContributionBodySchema,
    settlementBodySchema,
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

export default router;
