import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema } from './common';

// Optional soft spend limit, in cents. 0 and null both mean "no limit"; the cap
// mirrors the client's MAX_AMOUNT of ₹10,00,000.
const limitCentsSchema = z
    .number()
    .int('Spend limit must be a whole number of cents')
    .min(0, 'Spend limit cannot be negative')
    .max(100_000_000, 'Spend limit cannot exceed ₹10,00,000')
    .nullable()
    .optional();

export const createCategoryBodySchema = z.object({
    groupId: groupIdParamSchema,
    name: z.string().trim().min(3, 'Name must be at least 3 characters').max(50, 'Name must be at most 50 characters'),
    color: z.string().trim().max(20).optional(),
    type: z.enum(['EXPENSE', 'CREDIT']).optional(),
    limitCents: limitCentsSchema,
});

export const updateCategoryParamsSchema = z.object({
    id: objectIdSchema,
});

export const updateCategoryBodySchema = z
    .object({
        groupId: groupIdParamSchema,
        color: z.string().trim().min(1, 'Color is required').max(20, 'Color must be at most 20 characters').optional(),
        isSpecial: z.boolean().optional(),
        limitCents: limitCentsSchema,
    })
    .refine((d) => d.color !== undefined || d.isSpecial !== undefined || d.limitCents !== undefined, {
        message: 'Nothing to update',
    });

export const deleteCategoryParamsSchema = z.object({
    id: objectIdSchema,
    groupId: groupIdParamSchema,
});

export const getCategoryParamsSchema = z.object({
    groupId: groupIdParamSchema,
});

export const getCategoryQuerySchema = z.object({
    type: z.enum(['EXPENSE', 'CREDIT']).optional(),
});

export type CreateCategoryDto = z.infer<typeof createCategoryBodySchema>;
