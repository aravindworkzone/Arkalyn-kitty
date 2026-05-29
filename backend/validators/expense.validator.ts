import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema, paginationQuerySchema } from './common';
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
    description: z.string().trim().max(500, 'Description must be at most 500 characters').optional(),
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

// Pagination + optional filters for the "all expenses" list. Lets the report page
// deep-link into a pre-filtered view by category, member, or date range.
export const allExpensesQuerySchema = paginationQuerySchema.extend({
    categoryId: objectIdSchema.optional(),
    paidBy: objectIdSchema.optional(),
    startDate: z.coerce.date({ message: 'Invalid start date' }).optional(),
    endDate: z.coerce.date({ message: 'Invalid end date' }).optional(),
});

export type CreateExpenseDto = z.infer<typeof createExpenseBodySchema>;
export type AllExpensesQuery = z.infer<typeof allExpensesQuerySchema>;
