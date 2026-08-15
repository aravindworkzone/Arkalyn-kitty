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
    creditCategory: objectIdSchema.optional(),
    // Which connected group's money this spend is attributed to. Attribution
    // only — the service checks there is an ACTIVE link before storing it.
    fundedByGroup: objectIdSchema.optional(),
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

export const updateExpenseParamsSchema = z.object({
    id: objectIdSchema,
});

// Editing accepts the same field shape as creating. The expense id comes from
// the route param; `groupId` in the body is still required for `loadGroup`.
export const updateExpenseBodySchema = createExpenseBodySchema;

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

export const getOneExpenseParamsSchema = z.object({
    groupId: groupIdParamSchema,
    id: objectIdSchema,
});

// Pagination + optional filters for the "all expenses" list. Lets the report page
// deep-link into a pre-filtered view by category, member, or date range.
export const allExpensesQuerySchema = paginationQuerySchema.extend({
    categoryId: objectIdSchema.optional(),
    paidBy: objectIdSchema.optional(),
    // Filter to expenses a member spent on (in the split, or — for unsplit
    // expenses — the payer). Mirrors the member report's attribution.
    spender: objectIdSchema.optional(),
    // Which connected group's money the expense was attributed to. Three states,
    // not two: absent = no filter, an id = that funder, and the literal 'own' =
    // only expenses drawn from the group's own wallet. Without the sentinel there
    // is no way to ask for the complement of "funded by someone".
    fundedBy: z.union([z.literal('own'), objectIdSchema]).optional(),
    startDate: z.coerce.date({ message: 'Invalid start date' }).optional(),
    endDate: z.coerce.date({ message: 'Invalid end date' }).optional(),
});

export const duplicateCheckQuerySchema = z.object({
    // RUPEES, and fractional ones are legal — same units as createExpenseBodySchema.
    // This used to be `.int()` labelled "(paise)", which was wrong on both counts:
    // the caller sends rupees (the schema's toDBAmount setter converts them on the
    // equality filter), so any amount with paise — ₹250.50 — was rejected with a
    // 400 that the lazy query swallowed, and no duplicate was ever reported for it.
    amount: z.coerce.number().positive('Amount must be positive'),
    date: z.coerce.date({ message: 'Invalid date' }),
    category: objectIdSchema.optional(),
    excludeExpenseId: objectIdSchema.optional(),
});

export const titleSuggestionsQuerySchema = z.object({
    // Optional prefix/substring filter. Capped at the title length so a caller
    // cannot push an arbitrarily long string into a regex.
    q: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(10).default(6),
});

export type CreateExpenseDto = z.infer<typeof createExpenseBodySchema>;
export type AllExpensesQuery = z.infer<typeof allExpensesQuerySchema>;
export type DuplicateCheckQuery = z.infer<typeof duplicateCheckQuerySchema>;
export type TitleSuggestionsQuery = z.infer<typeof titleSuggestionsQuerySchema>;
