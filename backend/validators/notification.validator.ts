import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common';

export const notificationIdParamsSchema = z.object({
    id: objectIdSchema,
});

// `unread` is a string enum rather than z.coerce.boolean(): coercion turns the
// string "false" into `true`, which would make ?unread=false mean its opposite.
export const listNotificationsQuerySchema = paginationQuerySchema.extend({
    unread: z.enum(['true', 'false']).optional(),
});
