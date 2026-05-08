import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_ENV_VARS = [
    'PORT',
    'MONGO_URI',
    'JWT_SECRET',
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
    JWT_SECRET: process.env.JWT_SECRET as string,
    FRONTEND_URL: process.env.FRONTEND_URL as string,
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production',
};
