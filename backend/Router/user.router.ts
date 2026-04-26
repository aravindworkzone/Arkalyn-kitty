import express from 'express';
import { userGroups, GetUser, VerifyUser } from '../Controller/user.controller';
import {verifyToken, authorizeRole, loadGroup} from '../Middleware/auth.middleware';
const router = express.Router();

router.get('/me', verifyToken, GetUser);
router.get('/usergroups',verifyToken , userGroups);
router.post('/verifyuser',verifyToken , VerifyUser);

export default router;