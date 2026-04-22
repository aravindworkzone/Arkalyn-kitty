import express from 'express';
import { SignUp, SignIn, SignOut } from '../Controller/auth.controller';
import {verifyToken} from '../Middleware/auth.middleware';
const router = express.Router();

router.post('/signup', SignUp);
router.post('/signin', SignIn);
router.post('/signout', verifyToken, SignOut);

export default router;