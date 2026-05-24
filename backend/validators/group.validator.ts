import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema } from './common';

export const createGroupBodySchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, 'Name must be at least 3 characters')
        .max(100, 'Name must be at most 100 characters')
        .regex(/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/, 'Name may contain letters, numbers, and single spaces'),
    contribution: z.number().nonnegative('Contribution cannot be negative'),
    invitees: z.array(objectIdSchema).default([]),
});

export const groupIdParamObject = z.object({ groupId: groupIdParamSchema });

export const manageMemberBodySchema = z.object({
    groupId: groupIdParamSchema,
    action: z.enum(['add', 'remove']),
    Member: objectIdSchema,
    contribution: z.number().nonnegative().optional(),
});

export const inviteMemberBodySchema = z.object({
    groupId: groupIdParamSchema,
    invitedUser: objectIdSchema,
});

export const manageAdminBodySchema = z.object({
    groupId: groupIdParamSchema,
    action: z.enum(['promote', 'demote']),
    member: objectIdSchema,
});

export const addContributionBodySchema = z.object({
    groupId: groupIdParamSchema,
    contribution: z.number().positive('Contribution must be positive'),
    userId: objectIdSchema.optional(),
    description: z.string().trim().max(200, 'Description too long').optional(),
});

export const settlementBodySchema = z.object({
    groupId: groupIdParamSchema,
    settlement: z.number().nonnegative('Settlement amount cannot be negative'),
    member: objectIdSchema,
});

export const leaveGroupBodySchema = z.object({
    groupId: groupIdParamSchema,
    mode: z.enum(['settlement', 'forfeit']).optional(),
});

export const approveLeaveBodySchema = z.object({
    groupId: groupIdParamSchema,
    member: objectIdSchema,
    settlement: z.number().nonnegative('Settlement amount cannot be negative'),
});

export const rejectLeaveBodySchema = z.object({
    groupId: groupIdParamSchema,
    member: objectIdSchema,
});

export const cancelOwnLeaveBodySchema = z.object({
    groupId: groupIdParamSchema,
});

export const toggleFavoriteBodySchema = z.object({
    groupId: groupIdParamSchema,
    isFavorite: z.boolean(),
});

export const removeCreditParamsSchema = z.object({
    creditId: objectIdSchema,
});

export const removeCreditBodySchema = z.object({
    groupId: groupIdParamSchema,
    reason: z.string().trim().min(1).max(500).optional(),
});

export type CreateGroupDto = z.infer<typeof createGroupBodySchema>;
export type ManageMemberDto = z.infer<typeof manageMemberBodySchema>;
export type InviteMemberDto = z.infer<typeof inviteMemberBodySchema>;
export type ManageAdminDto = z.infer<typeof manageAdminBodySchema>;
export type AddContributionDto = z.infer<typeof addContributionBodySchema>;
export type SettlementDto = z.infer<typeof settlementBodySchema>;
export type LeaveGroupDto = z.infer<typeof leaveGroupBodySchema>;
export type ApproveLeaveDto = z.infer<typeof approveLeaveBodySchema>;
export type RejectLeaveDto = z.infer<typeof rejectLeaveBodySchema>;
