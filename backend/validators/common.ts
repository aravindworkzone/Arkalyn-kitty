import { z } from 'zod';
import mongoose from 'mongoose';

export const objectIdSchema = z
    .string()
    .refine((value) => mongoose.Types.ObjectId.isValid(value), {
        message: 'Invalid ID format',
    });

export const groupIdParamSchema = z
    .string()
    .min(1, 'Group ID is required')
    .refine(
        (value) => mongoose.isValidObjectId(value) || /^Grp-\d{2}-\d+$/i.test(value),
        { message: 'Invalid group ID format' }
    );

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
