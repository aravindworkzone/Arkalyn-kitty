import type { CookieOptions, Request, Response } from 'express';
import {
    SignUpService,
    LoginService,
    RefreshService,
    LogoutService,
} from '../services/auth.service';
import { AppError } from '../helpers/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { env } from '../config/env';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../config/constants';

const baseCookieOptions = (): CookieOptions => ({
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
});

const setAuthCookies = (
    res: Response,
    tokens: { accessToken: string; refreshToken: string; accessTokenMaxAgeMs: number; refreshTokenMaxAgeMs: number }
): void => {
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
        ...baseCookieOptions(),
        maxAge: tokens.accessTokenMaxAgeMs,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
        ...baseCookieOptions(),
        maxAge: tokens.refreshTokenMaxAgeMs,
    });
};

const clearAuthCookies = (res: Response): void => {
    const opts = baseCookieOptions();
    res.clearCookie(ACCESS_TOKEN_COOKIE, opts);
    res.clearCookie(REFRESH_TOKEN_COOKIE, opts);
};

const getDeviceInfo = (req: Request): string => {
    const ua = req.headers['user-agent'];
    return typeof ua === 'string' ? ua.slice(0, 500) : '';
};

export const SignUp = asyncHandler(async (req, res) => {
    const result = await SignUpService(req.body);
    sendCreated(res, { user: result }, 'User created successfully');
});

export const Login = asyncHandler(async (req, res) => {
    const result = await LoginService(req.body, getDeviceInfo(req));
    setAuthCookies(res, result.tokens);
    sendSuccess(res, { user: result.user }, 'User signed in successfully');
});

export const Refresh = asyncHandler(async (req, res) => {
    const rawRefreshToken: string | undefined = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!rawRefreshToken) {
        throw new AppError('Refresh token missing', 401);
    }

    try {
        const tokens = await RefreshService(rawRefreshToken, getDeviceInfo(req));
        setAuthCookies(res, tokens);
        sendSuccess(res, null, 'Tokens refreshed');
    } catch (err) {
        clearAuthCookies(res);
        throw err;
    }
});

export const Logout = asyncHandler(async (req, res) => {
    const rawRefreshToken: string | undefined = req.cookies?.[REFRESH_TOKEN_COOKIE];
    await LogoutService(rawRefreshToken);
    clearAuthCookies(res);
    sendSuccess(res, null, 'User signed out successfully');
});
