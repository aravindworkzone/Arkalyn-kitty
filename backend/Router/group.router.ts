import express from 'express';
import { createGroup, deleteGroup, manageMember, manageAdmin, addContribution, Settlement, getGroupById, getGroupMember, getBasicTransaction, getTransaction, getEvent } from '../Controller/group.controller';
import {verifyToken, authorizeRole, loadGroup} from '../Middleware/auth.middleware';
const router = express.Router();

router.post('/create', verifyToken, createGroup);
router.delete('/delete/:groupId', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN"), deleteGroup);
router.post('/managemember', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), manageMember);
router.post('/manageadmin', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN"), manageAdmin);
router.post('/addcontribution', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), addContribution);
router.post('/settlement', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), Settlement);
router.get('/getgroupbyid/:groupId', verifyToken, loadGroup, getGroupById);
router.get('/getgroupmembers/:groupId', verifyToken, loadGroup, getGroupMember);
router.get('/getbasictransaction/:groupId', verifyToken, loadGroup, getBasicTransaction);
router.get('/getTransaction/:groupId', verifyToken, loadGroup, getTransaction);
router.get('/getEvent/:groupId', verifyToken, loadGroup, getEvent);

export default router;