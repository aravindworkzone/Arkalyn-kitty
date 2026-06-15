import crypto from 'crypto';

// Personal API key format: `ak_live_` + 32 url-safe random chars (40 total).
// 24 random bytes → exactly 32 base64url chars (24 / 3 * 4), so the key carries
// 192 bits of entropy — unguessable.
export const API_KEY_PREFIX_LABEL = 'ak_live_';

// How many leading characters are stored in plaintext (apiKeyPrefix). We keep
// `ak_live_` + the first 8 random chars (16 total) rather than the literal
// "first 8 chars" — those would be the constant `ak_live_` for every user,
// useless for both the masked display ("ak_live_XXXXXXXX…") and as the lookup
// filter apiKeyAuth uses to find a candidate before the bcrypt compare.
export const API_KEY_PREFIX_LENGTH = 16;

export const generateApiKey = (): string =>
    `${API_KEY_PREFIX_LABEL}${crypto.randomBytes(24).toString('base64url')}`;

export const apiKeyPrefixOf = (key: string): string => key.slice(0, API_KEY_PREFIX_LENGTH);
