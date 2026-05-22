import express from 'express';
import {
    SignUp,
    Login,
    Refresh,
    Logout,
    ForgotPassword,
    ResetPassword,
} from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
    signUpBodySchema,
    signInBodySchema,
    forgotPasswordBodySchema,
    resetPasswordBodySchema,
} from '../validators/auth.validator';

const router = express.Router();

router.post('/signup', validate({ body: signUpBodySchema }), SignUp);
router.post('/login', validate({ body: signInBodySchema }), Login);
router.post('/refresh', Refresh);
router.post('/logout', verifyToken, Logout);
router.post('/forgot-password', validate({ body: forgotPasswordBodySchema }), ForgotPassword);
router.post('/reset-password', validate({ body: resetPasswordBodySchema }), ResetPassword);

export default router;
