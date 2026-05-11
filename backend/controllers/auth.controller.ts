import { SignUpService, SignInService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { env } from '../config/env';
import { COOKIE_NAME, COOKIE_MAX_AGE_MS } from '../config/constants';

export const SignUp = asyncHandler(async (req, res) => {
    const result = await SignUpService(req.body);
    sendCreated(res, { user: result }, 'User created successfully');
});

export const SignIn = asyncHandler(async (req, res) => {
    const result = await SignInService(req.body);

    res.cookie(COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: env.isProduction ? 'none' : 'lax',
        maxAge: COOKIE_MAX_AGE_MS,
    });

    sendSuccess(res, { user: result.user }, 'User signed in successfully');
});

export const SignOut = asyncHandler(async (_req, res) => {
    res.clearCookie(COOKIE_NAME);
    sendSuccess(res, null, 'User signed out successfully');
});
