import { z } from 'zod';

export const listUsersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    // Server-side filter so admins can slice a 10k-row table without paging
    // blindly. No `plan` here — accounts hold no tier; use /subscriptions.
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
    sort: z.enum(['newest', 'oldest']).default('newest'),
});

// Group subscription table. `plan` filters on the stored tier (what the group
// bought); each row still reports the computed effective tier alongside it.
export const listSubscriptionsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    plan: z.enum(['FREE', 'PRO', 'PREMIUM', 'ORG']).optional(),
    sort: z.enum(['newest', 'oldest']).default('newest'),
});

export const userIdParamSchema = z.object({
    userId: z.string().trim().min(1, 'userId is required'),
});

export const groupIdParamSchema = z.object({
    groupId: z.string().trim().min(1, 'groupId is required'),
});

export const promoIdParamSchema = z.object({
    id: z.string().trim().min(1, 'id is required'),
});

// New codes grant sellable tiers only — minting fresh PREMIUM grants would keep
// a retired tier alive in the wild. Codes already issued against PREMIUM still
// redeem: redemption reads the stored code, not this schema.
export const createPromoBodySchema = z.object({
    code: z.string().trim().min(1, 'Code is required').max(60).toUpperCase(),
    plan: z.enum(['PRO', 'ORG']),
    cycle: z.enum(['monthly', 'yearly']),
    maxRedemptions: z.number().int().positive().nullish(),
    expiresAt: z.string().datetime().optional(),
});

// The app owner's manual override keeps PREMIUM, unlike the customer-facing
// paths: this is the tool for repairing a legacy row, so it has to be able to
// name the legacy tier.
export const overridePlanBodySchema = z.object({
    plan: z.enum(['FREE', 'PRO', 'PREMIUM', 'ORG']),
    cycle: z.enum(['monthly', 'yearly']).optional(),
    expiresAt: z.string().datetime().optional(),
});

export const analyticsQuerySchema = z.object({
    granularity: z.enum(['day', 'week', 'month']).default('month'),
});

// Paywall-hit lookback. Capped at a year because the collection's TTL keeps two,
// and an unbounded window would let one request scan the whole thing.
export const demandQuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuerySchema>;
export type CreatePromoDto = z.infer<typeof createPromoBodySchema>;
export type OverridePlanDto = z.infer<typeof overridePlanBodySchema>;
