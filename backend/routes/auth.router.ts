import express from 'express';
import { SignUp, Login, Refresh, Logout } from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { signUpBodySchema, signInBodySchema } from '../validators/auth.validator';

const router = express.Router();

router.post('/signup', validate({ body: signUpBodySchema }), SignUp);
router.post('/login', validate({ body: signInBodySchema }), Login);
router.post('/refresh', Refresh);
router.post('/logout', verifyToken, Logout);

export default router;
