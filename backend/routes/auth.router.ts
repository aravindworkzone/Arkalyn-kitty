import express from 'express';
import { SignUp, SignIn, SignOut } from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { signUpBodySchema, signInBodySchema } from '../validators/auth.validator';

const router = express.Router();

router.post('/signup', validate({ body: signUpBodySchema }), SignUp);
router.post('/signin', validate({ body: signInBodySchema }), SignIn);
router.post('/signout', verifyToken, SignOut);

export default router;
