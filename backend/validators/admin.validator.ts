import { z } from 'zod';

export const listUsersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
});

export const userIdParamSchema = z.object({
    userId: z.string().trim().min(1, 'userId is required'),
});

export const promoIdParamSchema = z.object({
    id: z.string().trim().min(1, 'id is required'),
});

export const createPromoBodySchema = z.object({
    code: z.string().trim().min(1, 'Code is required').max(60).toUpperCase(),
    plan: z.enum(['PRO', 'PREMIUM']),
    cycle: z.enum(['monthly', 'yearly']),
    maxRedemptions: z.number().int().positive().nullish(),
    expiresAt: z.string().datetime().optional(),
});

export const overridePlanBodySchema = z.object({
    plan: z.enum(['FREE', 'PRO', 'PREMIUM']),
    cycle: z.enum(['monthly', 'yearly']).optional(),
    expiresAt: z.string().datetime().optional(),
});

export const analyticsQuerySchema = z.object({
    granularity: z.enum(['day', 'week', 'month']).default('month'),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreatePromoDto = z.infer<typeof createPromoBodySchema>;
export type OverridePlanDto = z.infer<typeof overridePlanBodySchema>;
