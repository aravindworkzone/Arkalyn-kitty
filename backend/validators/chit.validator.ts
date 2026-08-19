import { z } from 'zod';
import { objectIdSchema, groupIdParamSchema, paginationQuerySchema } from './common';
import { PAYMENT_TYPES } from '../models/expense.model';
import { MAX_CHIT_PARTICIPANTS } from '../models/chit_scheme.model';

/**
 * Money arrives in rupees, like every other group money path.
 *
 * Whole rupees only. The wire format is a float and the schema setter multiplies
 * by 100, so a paise-precision amount would be an invitation to accumulate
 * rounding error across N² dues — and no chit is denominated in paise anyway.
 */
const rupeesSchema = z
    .number()
    .positive('Amount must be a positive number')
    .int('Amount must be a whole number of rupees')
    .max(10_000_000, 'Amount is too large');

// A calendar day, not an instant. Parsed in local time by the service — never
// handed to `new Date()`, which would read it as UTC midnight.
const isoDaySchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const createChitSchemeBodySchema = z.object({
    groupId: groupIdParamSchema,
    amountPerMember: rupeesSchema,
    startDate: isoDaySchema,
    cycleIntervalDays: z.number().int().min(1).max(365).default(30),
    dueDays: z.number().int().min(0).max(365).default(10),
    // Defaults to the caller. Only a SUPER_ADMIN may name someone else — enforced
    // in the service, since it depends on the caller's role.
    organizerUserId: objectIdSchema.optional(),
});

export const updateChitSchemeBodySchema = z.object({
    groupId: groupIdParamSchema,
    amountPerMember: rupeesSchema.optional(),
    startDate: isoDaySchema.optional(),
    cycleIntervalDays: z.number().int().min(1).max(365).optional(),
    dueDays: z.number().int().min(0).max(365).optional(),
    // The turn order. Positions are validated in the service as a contiguous
    // 1..N permutation — a rule about the array as a whole, which zod per-item
    // refinement expresses badly.
    participants: z
        .array(z.object({ userId: objectIdSchema, position: z.number().int().min(1) }))
        .min(2, 'A chit needs at least two members')
        .max(MAX_CHIT_PARTICIPANTS, `A chit can have at most ${MAX_CHIT_PARTICIPANTS} members`)
        .optional(),
});

export const activateChitBodySchema = z.object({ groupId: groupIdParamSchema });

// Dates only. Amount, participants and order are frozen at activation — they
// produced the history already recorded.
export const rescheduleChitBodySchema = z
    .object({
        groupId: groupIdParamSchema,
        startDate: isoDaySchema.optional(),
        cycleIntervalDays: z.number().int().min(1).max(365).optional(),
        dueDays: z.number().int().min(0).max(365).optional(),
    })
    .refine(
        (v) => v.startDate !== undefined || v.cycleIntervalDays !== undefined || v.dueDays !== undefined,
        { message: 'Nothing to reschedule' }
    );

export const cancelChitBodySchema = z.object({
    groupId: groupIdParamSchema,
    reason: z.string().trim().min(3, 'Give a reason').max(300),
});

export const reassignOrganizerBodySchema = z.object({
    groupId: groupIdParamSchema,
    organizerUserId: objectIdSchema,
});

export const markDueBodySchema = z.object({
    groupId: groupIdParamSchema,
    dueId: objectIdSchema,
    paymentType: z.enum(PAYMENT_TYPES).optional(),
});

export const unmarkDueBodySchema = z.object({
    groupId: groupIdParamSchema,
    dueId: objectIdSchema,
});

export const releasePayoutBodySchema = z.object({
    groupId: groupIdParamSchema,
    cycleId: objectIdSchema,
    // Required when the cycle is short. The organizer is confirming that the
    // recipient gets less than the full pot, which is a decision someone owns.
    acknowledgeShortfall: z.boolean().optional(),
});

export const chitBoardParamsSchema = z.object({ groupId: groupIdParamSchema });

export const chitBoardQuerySchema = z.object({
    cycle: z.coerce.number().int().min(1).optional(),
});

export const chitHistoryQuerySchema = paginationQuerySchema;
