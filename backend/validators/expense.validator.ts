import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema } from './common';
import { PAYMENT_TYPES } from '../models/expense.model';

const splitBetweenItemSchema = z.object({
    userId: objectIdSchema,
    amount: z.number().positive('Split amount must be positive'),
});

export const createExpenseBodySchema = z.object({
    groupId: groupIdParamSchema,
    category: objectIdSchema,
    title: z
        .string()
        .trim()
        .min(3, 'Title must be at least 3 characters')
        .max(100, 'Title must be at most 100 characters'),
    amount: z.number().positive('Amount must be positive'),
    paidBy: objectIdSchema,
    paymentType: z.enum(PAYMENT_TYPES),
    date: z.coerce.date({ message: 'Invalid date' }),
    splitBetween: z.array(splitBetweenItemSchema).optional(),
});

export const deleteExpenseParamsSchema = z.object({
    id: objectIdSchema,
});

export const deleteExpenseBodySchema = z.object({
    groupId: groupIdParamSchema,
    reason: z.string().trim().min(1).max(500).optional(),
});

export const groupIdOnlyParamsSchema = z.object({
    groupId: groupIdParamSchema,
});

export type CreateExpenseDto = z.infer<typeof createExpenseBodySchema>;
