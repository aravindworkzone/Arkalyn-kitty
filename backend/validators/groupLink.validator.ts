import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema } from './common';

// Every write carries the acting group's id in the body so loadGroup can
// resolve it — which group that is differs per route (host for /request,
// source for /approve, /reject and /transfer), and that is what the middleware
// chain authorizes against.

export const requestLinkBodySchema = z.object({
    groupId: groupIdParamSchema,
    // The group being asked for funding, by ObjectId or Grp-YY-NNN displayId.
    sourceGroupRef: z.string().trim().min(1, 'Group ID is required'),
});

export const reviewLinkBodySchema = z.object({
    groupId: groupIdParamSchema,
    linkId: objectIdSchema,
});

export const transferBodySchema = z.object({
    groupId: groupIdParamSchema,
    linkId: objectIdSchema,
    amount: z.number().positive('Amount must be a positive number'),
    description: z.string().trim().max(500).optional(),
});

export const groupLinksParamsSchema = z.object({
    groupId: groupIdParamSchema,
});
