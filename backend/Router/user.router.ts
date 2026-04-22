import express from 'express';
import { userGroups, GetUser } from '../Controller/user.controller';
import {verifyToken, authorizeRole, loadGroup} from '../Middleware/auth.middleware';
const router = express.Router();

router.get('/me', verifyToken, GetUser);
router.get('/usergroups',verifyToken , userGroups);

export default router;