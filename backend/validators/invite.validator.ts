import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema } from './common';

export const acceptInviteBodySchema = z.object({
    inviteId: objectIdSchema,
    contribution: z.number().nonnegative('Contribution cannot be negative'),
});

export const rejectInviteBodySchema = z.object({
    inviteId: objectIdSchema,
});

// groupId rides in the body so loadGroup + authorizeRole can gate these on the
// reviewer's role in that group.
export const reviewJoinBodySchema = z.object({
    groupId: groupIdParamSchema,
    inviteId: objectIdSchema,
});

export const pendingJoinParamsSchema = z.object({ groupId: groupIdParamSchema });

export type AcceptInviteDto = z.infer<typeof acceptInviteBodySchema>;
export type RejectInviteDto = z.infer<typeof rejectInviteBodySchema>;
export type ReviewJoinDto = z.infer<typeof reviewJoinBodySchema>;
