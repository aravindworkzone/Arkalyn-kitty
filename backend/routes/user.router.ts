import express from 'express';
import { userGroups, GetUser, VerifyUser, SearchUsers, DeleteAccount } from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { verifyEmailBodySchema } from '../validators/auth.validator';

const router = express.Router();

router.get('/me', verifyToken, GetUser);
router.delete('/me', verifyToken, DeleteAccount);
router.get('/usergroups', verifyToken, userGroups);
router.get('/search', verifyToken, SearchUsers);
router.post('/verifyuser', validate({ body: verifyEmailBodySchema }), verifyToken, VerifyUser);

export default router;
