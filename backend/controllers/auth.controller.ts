import crypto from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import {
    SignUpService,
    LoginService,
    RefreshService,
    LogoutService,
    requestPasswordResetService,
    resetPasswordService,
    changePasswordService,
    OAuthService,
} from '../services/auth.service';
import { AppError } from '../helpers/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    OAUTH_STATE_COOKIE,
    OAUTH_STATE_TTL_MS,
    GOOGLE_AUTH_URI,
    GOOGLE_OAUTH_SCOPE,
} from '../config/constants';

const baseCookieOptions = (): CookieOptions => ({
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
});

// Deliberately 'lax' rather than 'strict': Google's callback is a cross-site
// top-level navigation, and 'strict' would withhold the cookie on exactly the
// request that needs to read it. Scoped to /api/auth so it travels no further.
const oauthStateCookieOptions = (): CookieOptions => ({
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/api/auth',
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

export const ForgotPassword = asyncHandler(async (req, res) => {
    await requestPasswordResetService(req.body.email);
    // Always the same generic response — never reveal whether the email exists.
    sendSuccess(
        res,
        null,
        'If an account exists for that email, a password reset link has been sent.'
    );
});

export const ResetPassword = asyncHandler(async (req, res) => {
    await resetPasswordService(req.body.token, req.body.password);
    sendSuccess(res, null, 'Password reset successfully. You can now sign in.');
});

export const ChangePassword = asyncHandler(async (req, res) => {
    if (!req.user?._id) throw new AppError('Unauthorized', 401);
    const { tokens } = await changePasswordService(
        req.user._id,
        req.body.currentPassword,
        req.body.newPassword,
        getDeviceInfo(req)
    );
    // Re-issue cookies for the current device — the old session was just revoked.
    setAuthCookies(res, tokens);
    sendSuccess(res, null, 'Password changed successfully');
});

// Fallback only. Every OAuth throw site now carries an explicit `code`, which is
// what actually gets used — this table exists for AppErrors raised further down
// the stack that predate the codes. It deliberately no longer claims that a 401
// means "unverified email": several unrelated failures share that status.
const OAUTH_ERROR_CODES: Record<number, string> = {
    403: 'account_suspended',
    409: 'account_conflict',
};

// Reasons the user is told about are also the ones we don't need a stack trace
// for: they are the user's situation, not a fault in the service.
const EXPECTED_OAUTH_CODES = new Set([
    'google_unverified',
    'account_conflict',
    'account_suspended',
    'account_unavailable',
]);

export const OAuthStart = (_req: Request, res: Response): void => {
    const state = crypto.randomBytes(32).toString('hex');
    res.cookie(OAUTH_STATE_COOKIE, state, {
        ...oauthStateCookieOptions(),
        maxAge: OAUTH_STATE_TTL_MS,
    });

    const url = new URL(GOOGLE_AUTH_URI);
    url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_OAUTH_SCOPE);
    url.searchParams.set('state', state);
    res.redirect(url.toString());
};

// Google's callback is a browser navigation, not an XHR — so every outcome ends
// in a redirect. Falling through to the JSON error handler would strand the user
// on a raw API response with no way back.
export const OAuth = async (req: Request, res: Response): Promise<void> => {
    // `ref` is set only for failures that produced a log line, so the user can
    // quote it and have it lead somewhere. Built through URLSearchParams because
    // these values now end up in a multi-parameter query string.
    const fail = (reason: string, ref?: string): void => {
        const params = new URLSearchParams({ error: reason, ...(ref ? { ref } : {}) });
        res.redirect(`${env.FRONTEND_URL}/login?${params}`);
    };

    // Read then immediately clear: the nonce is single-use, so a replayed
    // callback fails even if the authorization code is still live.
    const cookieState: string | undefined = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, oauthStateCookieOptions());

    if (req.query.error) return fail('google_denied');

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (!code) return fail('missing_code');
    if (!cookieState || cookieState !== state) return fail('invalid_state');

    try {
        const { tokens } = await OAuthService(code, getDeviceInfo(req));
        setAuthCookies(res, tokens);
        res.redirect(env.FRONTEND_DASHBOARD_URL);
    } catch (err) {
        // A short id shared between the log line and the URL the user ends up
        // on, so a screenshot of the failure is enough to find the trace.
        const ref = crypto.randomBytes(4).toString('hex');
        const reason =
            (err instanceof AppError && (err.code ?? OAUTH_ERROR_CODES[err.statusCode])) ||
            'oauth_failed';

        // Pass the Error itself, not err.message: pino's standard serializer
        // records the stack, and Mongoose hangs its per-field validation detail
        // off properties that stringifying would throw away. Anything we did not
        // anticipate is an error, not a warning — a failure nobody is watching
        // for is exactly the one worth surfacing.
        const expected = err instanceof AppError && EXPECTED_OAUTH_CODES.has(reason);
        const log = expected ? logger.warn.bind(logger) : logger.error.bind(logger);
        log(
            {
                err,
                ref,
                reason,
                // Driver-level detail on a failed write: `code` is numeric there
                // (11000 is a duplicate key), which is also what distinguishes it
                // from AppError's own string `code`.
                ...(err instanceof AppError
                    ? {}
                    : {
                          mongoCode: (err as { code?: unknown })?.code,
                          validation: (err as { errors?: unknown })?.errors,
                      }),
            },
            'Google OAuth callback failed'
        );

        fail(reason, ref);
    }
};
