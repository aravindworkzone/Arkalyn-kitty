export const JWT_EXPIRES_IN = '1d';

export const COOKIE_NAME = 'AccessToken';

export const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const BCRYPT_SALT_ROUNDS = 10;

export const REQUEST_BODY_LIMIT = '1mb';

export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
} as const;

export const RATE_LIMIT = {
    AUTH_WINDOW_MS: 15 * 60 * 1000,
    AUTH_MAX_ATTEMPTS: 10,
    GLOBAL_WINDOW_MS: 15 * 60 * 1000,
    GLOBAL_MAX_REQUESTS: 300,
} as const;

export const DB_RETRY = {
    MAX_ATTEMPTS: 5,
    INITIAL_DELAY_MS: 1000,
    MAX_DELAY_MS: 30_000,
} as const;

export const ROLES = {
    ADMIN: 'admin',
    MEMBER: 'member',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];
