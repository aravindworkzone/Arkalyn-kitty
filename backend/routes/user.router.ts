import express from 'express';
import { userGroups, GetUser, VerifyUser, SearchUsers } from '../controllers/user.controller';
import {verifyToken, authorizeRole, loadGroup} from '../middlewares/auth.middleware';
const router = express.Router();

router.get('/me', verifyToken, GetUser);
router.get('/usergroups',verifyToken , userGroups);
router.get('/search', verifyToken, SearchUsers);
router.post('/verifyuser',verifyToken , VerifyUser);

export default router;