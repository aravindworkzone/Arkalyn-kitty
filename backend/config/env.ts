import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_ENV_VARS = [
    'PORT',
    'MONGO_URI',
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'FRONTEND_URL',
] as const;

type RequiredEnvVar = typeof REQUIRED_ENV_VARS[number];

export const validateEnv = (): void => {
    const missing: RequiredEnvVar[] = [];

    for (const key of REQUIRED_ENV_VARS) {
        if (!process.env[key] || process.env[key]?.trim() === '') {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}. ` +
            `Set them in backend/.env before starting the server.`
        );
    }
};

export const env = {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: Number(process.env.PORT) || 5000,
    MONGO_URI: process.env.MONGO_URI as string,
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET as string,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET as string,
    ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN?.trim() || '15m',
    REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN?.trim() || '7d',
    // Trailing slashes silently break CORS — browsers send `Origin` without one.
    // Empty string when unset; validateEnv() rejects that before the app serves.
    FRONTEND_URL: (process.env.FRONTEND_URL ?? '').replace(/\/+$/, ''),
    // Resend HTTP API for transactional email (password reset). Optional — the
    // app boots without a key; email simply degrades to a logged warning.
    // RESEND_FROM defaults to onboarding@resend.dev (no domain verification
    // needed) — override once you've verified your own sending domain.
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
    RESEND_FROM: process.env.RESEND_FROM ?? '',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production',
};
