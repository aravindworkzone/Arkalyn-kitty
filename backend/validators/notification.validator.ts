import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common';

export const notificationIdParamsSchema = z.object({
    id: objectIdSchema,
});

export const listNotificationsQuerySchema = paginationQuerySchema;
