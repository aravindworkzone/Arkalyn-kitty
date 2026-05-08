import express from 'express';
import { SignUp, SignIn, SignOut } from '../controllers/auth.controller';
import {verifyToken} from '../middlewares/auth.middleware';
const router = express.Router();

router.post('/signup', SignUp);
router.post('/signin', SignIn);
router.post('/signout', verifyToken, SignOut);

export default router;