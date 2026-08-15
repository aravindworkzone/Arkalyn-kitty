import { z } from 'zod';
import { groupIdParamSchema } from './common';

// Tokens are 24 random bytes as base64url — 32 chars from the url-safe
// alphabet. Pinning the shape here keeps junk out of the lookup entirely.
const joinTokenSchema = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{16,64}$/, 'Invalid join link');

export const joinLinkGroupBodySchema = z.object({
    groupId: groupIdParamSchema,
});

export const joinLinkGroupParamsSchema = z.object({
    groupId: groupIdParamSchema,
});

export const joinLinkTokenParamsSchema = z.object({
    token: joinTokenSchema,
});

export const joinViaLinkBodySchema = z.object({
    token: joinTokenSchema,
    contribution: z.number().nonnegative('Contribution cannot be negative'),
});
