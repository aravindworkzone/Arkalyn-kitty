import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema } from './common';

const memberInputSchema = z.object({
    _id: objectIdSchema,
    contribution: z.number().nonnegative('Contribution cannot be negative'),
});

export const createGroupBodySchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, 'Name must be at least 3 characters')
        .max(100, 'Name must be at most 100 characters')
        .regex(/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/, 'Name may contain letters, numbers, and single spaces'),
    members: z.array(memberInputSchema).min(1, 'At least one member is required'),
});

export const groupIdParamObject = z.object({ groupId: groupIdParamSchema });

export const manageMemberBodySchema = z.object({
    groupId: groupIdParamSchema,
    action: z.enum(['add', 'remove']),
    Member: objectIdSchema,
    contribution: z.number().nonnegative().optional(),
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
    settlement: z.number().positive('Settlement amount must be positive'),
    member: objectIdSchema,
});

export type CreateGroupDto = z.infer<typeof createGroupBodySchema>;
export type ManageMemberDto = z.infer<typeof manageMemberBodySchema>;
export type ManageAdminDto = z.infer<typeof manageAdminBodySchema>;
export type AddContributionDto = z.infer<typeof addContributionBodySchema>;
export type SettlementDto = z.infer<typeof settlementBodySchema>;
