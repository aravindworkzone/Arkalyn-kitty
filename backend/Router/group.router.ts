import express from 'express';
import { createGroup, deleteGroup, manageMember, manageAdmin, addContribution, Settlement, getGroupById, getGroupMember } from '../Controller/group.controller';
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

export default router;