import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema } from './common';

export const closeGroupBodySchema = z.object({
    groupId: groupIdParamSchema.optional(),
    overrides: z
        .array(
            z.object({
                userId: objectIdSchema,
                refundAmount: z.number().nonnegative('Refund amount cannot be negative'),
            })
        )
        .optional(),
});

export type CloseGroupDto = z.infer<typeof closeGroupBodySchema>;
