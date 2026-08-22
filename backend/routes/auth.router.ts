import express from 'express';
import {
    OAuth,
    OAuthStart,
    SignUp,
    Login,
    Refresh,
    Logout,
    ForgotPassword,
    ResetPassword,
    ChangePassword,
} from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { authRateLimiter, sessionRateLimiter } from '../middlewares/security.middleware';
import {
    signUpBodySchema,
    signInBodySchema,
    forgotPasswordBodySchema,
    resetPasswordBodySchema,
    changePasswordBodySchema,
} from '../validators/auth.validator';

const router = express.Router();

// Rate limiting is per-route rather than mounted over the whole router: the
// credential endpoints need the tight budget, but session upkeep and the OAuth
// redirects must not be able to spend it.
router.get('/oauth/start', sessionRateLimiter, OAuthStart);
router.get('/oauth', sessionRateLimiter, OAuth);
router.post('/signup', authRateLimiter, validate({ body: signUpBodySchema }), SignUp);
router.post('/login', authRateLimiter, validate({ body: signInBodySchema }), Login);
router.post('/refresh', sessionRateLimiter, Refresh);
router.post('/logout', sessionRateLimiter, verifyToken, Logout);
router.post('/forgot-password', authRateLimiter, validate({ body: forgotPasswordBodySchema }), ForgotPassword);
router.post('/reset-password', authRateLimiter, validate({ body: resetPasswordBodySchema }), ResetPassword);
router.post('/change-password', authRateLimiter, verifyToken, validate({ body: changePasswordBodySchema }), ChangePassword);

export default router;
