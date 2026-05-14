import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import mongoose from 'mongoose';
import Session from '../models/session.model';
import { AppError } from '../helpers/AppError';
import { parseDurationMs } from '../helpers/duration';
import { env } from '../config/env';
import { BCRYPT_SALT_ROUNDS, MAX_ACTIVE_SESSIONS } from '../config/constants';

export interface AccessTokenPayload {
    userId: string;
    role: string;
}

export interface RefreshTokenPayload {
    userId: string;
}

export interface IssuedTokens {
    accessToken: string;
    refreshToken: string;
    accessTokenMaxAgeMs: number;
    refreshTokenMaxAgeMs: number;
}

export const signAccessToken = (payload: AccessTokenPayload): string => {
    const options: SignOptions = {
        expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
    };
    return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, options);
};

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
    const options: SignOptions = {
        expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
    };
    return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, options);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
    return jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
    return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
};

const enforceSessionLimit = async (userId: mongoose.Types.ObjectId): Promise<void> => {
    const activeCount = await Session.countDocuments({
        userId,
        expiresAt: { $gt: new Date() },
    });

    if (activeCount < MAX_ACTIVE_SESSIONS) return;

    const evictCount = activeCount - MAX_ACTIVE_SESSIONS + 1;
    const oldest = await Session.find({ userId, expiresAt: { $gt: new Date() } })
        .sort({ createdAt: 1 })
        .limit(evictCount)
        .select('_id');

    if (oldest.length === 0) return;

    const result = await Session.deleteMany({ _id: { $in: oldest.map((s) => s._id) } });
    if (result.deletedCount !== oldest.length) {
        throw new AppError('Failed to evict oldest session', 500);
    }
};

export const issueTokensForUser = async (
    userId: mongoose.Types.ObjectId,
    role: string,
    deviceInfo: string
): Promise<IssuedTokens> => {
    await enforceSessionLimit(userId);

    const accessToken = signAccessToken({ userId: userId.toString(), role });
    const refreshToken = signRefreshToken({ userId: userId.toString() });

    const refreshTokenMaxAgeMs = parseDurationMs(env.REFRESH_TOKEN_EXPIRES_IN);
    const accessTokenMaxAgeMs = parseDurationMs(env.ACCESS_TOKEN_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + refreshTokenMaxAgeMs);

    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);

    await Session.create({
        userId,
        refreshToken: refreshTokenHash,
        deviceInfo,
        lastUsedAt: new Date(),
        expiresAt,
    });

    return { accessToken, refreshToken, accessTokenMaxAgeMs, refreshTokenMaxAgeMs };
};

export const rotateSession = async (
    rawRefreshToken: string,
    role: string,
    deviceInfo: string
): Promise<IssuedTokens> => {
    let payload: RefreshTokenPayload;
    try {
        payload = verifyRefreshToken(rawRefreshToken);
    } catch {
        throw new AppError('Invalid or expired refresh token', 401);
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);
    const now = new Date();

    const sessions = await Session.find({ userId, expiresAt: { $gt: now } });

    let matched: typeof sessions[number] | null = null;
    for (const session of sessions) {
        const ok = await bcrypt.compare(rawRefreshToken, session.refreshToken);
        if (ok) {
            matched = session;
            break;
        }
    }

    if (!matched) {
        throw new AppError('Session not found or already revoked', 401);
    }

    await Session.deleteOne({ _id: matched._id });

    return issueTokensForUser(userId, role, deviceInfo);
};

export const revokeSession = async (rawRefreshToken: string): Promise<void> => {
    let payload: RefreshTokenPayload;
    try {
        payload = verifyRefreshToken(rawRefreshToken);
    } catch {
        return;
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);
    const sessions = await Session.find({ userId });

    for (const session of sessions) {
        const ok = await bcrypt.compare(rawRefreshToken, session.refreshToken);
        if (ok) {
            await Session.deleteOne({ _id: session._id });
            return;
        }
    }
};
