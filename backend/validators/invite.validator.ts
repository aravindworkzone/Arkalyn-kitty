import { z } from 'zod';
import { objectIdSchema } from './common';

export const acceptInviteBodySchema = z.object({
    inviteId: objectIdSchema,
    contribution: z.number().nonnegative('Contribution cannot be negative'),
});

export const rejectInviteBodySchema = z.object({
    inviteId: objectIdSchema,
});

export type AcceptInviteDto = z.infer<typeof acceptInviteBodySchema>;
export type RejectInviteDto = z.infer<typeof rejectInviteBodySchema>;
