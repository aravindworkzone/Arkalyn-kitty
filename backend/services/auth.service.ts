import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/user.model';
import PasswordReset from '../models/password_reset.model';
import Session from '../models/session.model';
import { AppError } from '../helpers/AppError';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { BCRYPT_SALT_ROUNDS, PASSWORD_RESET_TOKEN_TTL_MS } from '../config/constants';
import { sendPasswordResetEmail } from '../utils/email';
import type { SignUpDto, SignInDto } from '../types/dto';
import { issueTokensForUser, rotateSession, revokeSession, IssuedTokens } from './session.service';
import GoogleToken from '../utils/googletoken';

// Verifies Google ID tokens: signature against Google's rotating JWKS, plus
// `iss`, `exp`, and `aud` — the last is what rejects a token minted for a
// different application. Keys are fetched once and cached by the client.
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const SignUpService = async (data: SignUpDto) => {
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    const newUser = await User.create({
        name: data.name,
        email: data.email,
        password: hashedPassword,
    });

    return {
        name: newUser.name,
        email: newUser.email,
        _id: newUser._id,
        role: newUser.role
    };
};

export interface LoginResult {
    user: { _id: string; name: string; email: string };
    tokens: IssuedTokens;
}

export const LoginService = async (
    data: SignInDto,
    deviceInfo: string
): Promise<LoginResult> => {
    const user = await User.findOne({ email: data.email, status: { $ne: 'DELETED' } });
    if (!user) throw new AppError('Invalid credentials', 401);

    // A Google-only account has no password hash, and bcrypt.compare throws on
    // an undefined hash rather than returning false — so without this guard the
    // form answers a Google user with a 500 instead of a rejection. Same generic
    // message as a wrong password: which accounts exist is not ours to leak.
    if (!user.password) throw new AppError('Invalid credentials', 401);

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) throw new AppError('Invalid credentials', 401);

    if (user.status === 'SUSPENDED') throw new AppError('Your account has been suspended. Contact support.', 403);

    const tokens = await issueTokensForUser(
        user._id as import('mongoose').Types.ObjectId,
        user.role,
        deviceInfo
    );

    return {
        user: {
            _id: (user._id as import('mongoose').Types.ObjectId).toString(),
            name: user.name,
            email: user.email,
        },
        tokens,
    };
};

export const RefreshService = async (
    rawRefreshToken: string,
    deviceInfo: string
): Promise<IssuedTokens> => {
    return rotateSession(rawRefreshToken, deviceInfo);
};

export const LogoutService = async (rawRefreshToken: string | undefined): Promise<void> => {
    if (!rawRefreshToken) return;
    await revokeSession(rawRefreshToken);
};

// Only the SHA-256 hash of a reset token is persisted. The token is 256 bits of
// entropy, so an unsalted hash is safe and lets us look records up by token.
const hashResetToken = (rawToken: string): string =>
    crypto.createHash('sha256').update(rawToken).digest('hex');

export const requestPasswordResetService = async (email: string): Promise<void> => {
    const user = await User.findOne({ email });
    // Anti-enumeration: behave identically whether or not the email exists.
    // The controller returns the same generic message either way.
    if (!user) return;

    const userId = user._id as import('mongoose').Types.ObjectId;

    // One active reset per user — drop any previous tokens first.
    await PasswordReset.deleteMany({ userId });

    const rawToken = crypto.randomBytes(32).toString('hex');
    await PasswordReset.create({
        userId,
        tokenHash: hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    });

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    // Best-effort: a delivery failure must not leak account existence, so we
    // log it server-side and still let the controller report generic success.
    try {
        await sendPasswordResetEmail(user.email, resetUrl);
    } catch (err) {
        logger.error({ err, userId: userId.toString() }, 'Failed to send password reset email');
    }
};

// In-session password change. Verifies the current password, sets the new one,
// revokes every existing session (so other devices are logged out), then mints a
// fresh session for the current device so the user stays signed in here.
export const changePasswordService = async (
    userId: string | import('mongoose').Types.ObjectId,
    currentPassword: string,
    newPassword: string,
    deviceInfo: string
): Promise<{ tokens: IssuedTokens }> => {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    // Unlike the login path, naming the cause here leaks nothing — the caller is
    // already authenticated as this account — and "current password is incorrect"
    // would be unanswerable advice for someone who has never set one.
    if (!user.password) {
        throw new AppError(
            'This account signs in with Google, so it has no password to change.',
            400
        );
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new AppError('Current password is incorrect', 400);

    user.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.save();

    const id = user._id as import('mongoose').Types.ObjectId;
    await Session.deleteMany({ userId: id });
    const tokens = await issueTokensForUser(id, user.role, deviceInfo);

    return { tokens };
};

export const resetPasswordService = async (
    rawToken: string,
    newPassword: string
): Promise<void> => {
    const record = await PasswordReset.findOne({ tokenHash: hashResetToken(rawToken) });
    if (!record || record.expiresAt.getTime() < Date.now()) {
        throw new AppError('This password reset link is invalid or has expired', 400);
    }

    const user = await User.findById(record.userId);
    if (!user) {
        await PasswordReset.deleteMany({ userId: record.userId });
        throw new AppError('This password reset link is invalid or has expired', 400);
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.save();

    // Token is single-use; also revoke every session so a leaked/stolen login
    // cannot outlive the reset.
    await PasswordReset.deleteMany({ userId: record.userId });
    await Session.deleteMany({ userId: record.userId });
};

export const OAuthService = async (code: string, deviceInfo: string) => {
    const googleTokens = await GoogleToken(code);

    // Full verification, not a bare decode: signature, issuer, expiry, and
    // audience. Without the `aud` check an ID token issued to any other Google
    // client would be accepted here as proof of identity.
    const ticket = await googleClient.verifyIdToken({
        idToken: googleTokens.id_token,
        audience: env.GOOGLE_CLIENT_ID,
    });
    const decoded = ticket.getPayload();

    // An unverified address must never match an existing account — on custom
    // domains it can be claimed by someone who does not control the mailbox.
    if (!decoded?.email || !decoded.email_verified) {
        throw new AppError('Google account email is not verified', 401, undefined, 'google_unverified');
    }

    const email = decoded.email.toLowerCase();
    let user = await User.findOne({ googleId: decoded.sub });
    if (!user) user = await User.findOne({ email });

    if (user && user.email !== email) {
        const clash = await User.findOne({ email });
        if (clash) throw new AppError('That email is already in use by another account', 409, undefined, 'account_conflict');
        user.email = email;
        await user.save();
    }

    if (!user) {
        // `name` is only present when the profile scope is granted, and a few
        // accounts carry no display name at all — but it is required on the
        // model, so fall back to the address's local part.
        const name = decoded.name?.trim() || email.split('@')[0];
        user = await User.create({ name, email, authProvider: 'GOOGLE', googleId: decoded.sub });
    } else if (!user.googleId) {
        user.googleId = decoded.sub;
        await user.save();
    } else if (user.googleId && user.googleId !== decoded.sub ) {
        throw new AppError('This email is already linked to a different Google account', 409, undefined, 'account_conflict');
    }

    if (user.status === 'SUSPENDED') throw new AppError('Your account has been suspended. Contact support.', 403, undefined, 'account_suspended');
    if (user.status === 'DELETED') throw new AppError('Invalid credentials', 401, undefined, 'account_unavailable');

    const id = user._id as import('mongoose').Types.ObjectId;
    const tokens = await issueTokensForUser(id, user.role, deviceInfo);
    return { tokens };
};