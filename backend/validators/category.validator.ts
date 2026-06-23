import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema } from './common';

export const createCategoryBodySchema = z.object({
    groupId: groupIdParamSchema,
    name: z.string().trim().min(3, 'Name must be at least 3 characters').max(50, 'Name must be at most 50 characters'),
    color: z.string().trim().max(20).optional(),
    type: z.enum(['EXPENSE', 'CREDIT']).optional(),
});

export const updateCategoryParamsSchema = z.object({
    id: objectIdSchema,
});

export const updateCategoryBodySchema = z
    .object({
        groupId: groupIdParamSchema,
        color: z.string().trim().min(1, 'Color is required').max(20, 'Color must be at most 20 characters').optional(),
        isSpecial: z.boolean().optional(),
    })
    .refine((d) => d.color !== undefined || d.isSpecial !== undefined, {
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
