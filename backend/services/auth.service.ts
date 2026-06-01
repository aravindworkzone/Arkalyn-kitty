import bcrypt from 'bcrypt';
import crypto from 'crypto';
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
    const user = await User.findOne({ email: data.email });
    if (!user) throw new AppError('Invalid credentials', 401);

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) throw new AppError('Invalid credentials', 401);

    if (user.status === 'SUSPENDED') throw new AppError('Your account has been suspended. Contact support.', 403);
    if (user.status === 'DELETED') throw new AppError('Invalid credentials', 401);

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
