import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema } from './common';

export const createCategoryBodySchema = z.object({
    groupId: groupIdParamSchema,
    name: z.string().trim().min(3, 'Name must be at least 3 characters').max(50, 'Name must be at most 50 characters'),
    color: z.string().trim().max(20).optional(),
});

export const deleteCategoryParamsSchema = z.object({
    id: objectIdSchema,
    groupId: groupIdParamSchema,
});

export const getCategoryParamsSchema = z.object({
    groupId: groupIdParamSchema,
});

export type CreateCategoryDto = z.infer<typeof createCategoryBodySchema>;
