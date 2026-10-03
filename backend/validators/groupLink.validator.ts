import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema } from './common';

// Every write carries the acting group's id in the body so loadGroup can
// resolve it — which group that is differs per route (host for /request,
// source for /approve, /reject and /credit-limit; host for /repay), and that is what the middleware
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

// /approve may set the starting credit limit in the same step.
export const approveLinkBodySchema = reviewLinkBodySchema.extend({
    creditLimit: z.number().min(0, 'Credit limit must be zero or more').optional(),
});

export const creditLimitBodySchema = z.object({
    groupId: groupIdParamSchema,
    linkId: objectIdSchema,
    creditLimit: z.number().min(0, 'Credit limit must be zero or more'),
});

export const repayBodySchema = z.object({
    groupId: groupIdParamSchema,
    linkId: objectIdSchema,
    amount: z.number().positive('Amount must be a positive number'),
});

export const groupLinksParamsSchema = z.object({
    groupId: groupIdParamSchema,
});
