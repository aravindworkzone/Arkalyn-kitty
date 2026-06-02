import { z, type RefinementCtx } from 'zod';
import { groupIdParamSchema } from './common';

export const REPORT_PRESETS = ['this_month', 'last_month', 'all_time', 'custom'] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

const isoDate = z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Invalid ISO date');

export const categoryBreakdownParamsSchema = z.object({
    groupId: groupIdParamSchema,
});

const rangeShape = {
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    preset: z.enum(REPORT_PRESETS).optional(),
};

const rangeRefine = (
    val: { startDate?: string; endDate?: string; preset?: ReportPreset },
    ctx: RefinementCtx
) => {
    const hasAnyDate = Boolean(val.startDate || val.endDate);
    const customRequiresBoth = val.preset === 'custom' || (hasAnyDate && val.preset === undefined);

    if (customRequiresBoth) {
        if (!val.startDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['startDate'],
                message: 'startDate is required for a custom range',
            });
        }
        if (!val.endDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['endDate'],
                message: 'endDate is required for a custom range',
            });
        }
    }
    if (val.startDate && val.endDate && new Date(val.startDate) > new Date(val.endDate)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['endDate'],
            message: 'endDate must be on or after startDate',
        });
    }
};

export const categoryBreakdownQuerySchema = z.object(rangeShape).superRefine(rangeRefine);

// The spend-trend report takes the same date-range inputs as the category
// breakdown — alias the schemas so intent reads clearly.
export const reportRangeParamsSchema = categoryBreakdownParamsSchema;
export const reportRangeQuerySchema = categoryBreakdownQuerySchema;

// Member breakdown additionally chooses the attribution mode: who paid for each
// expense, or who the spend was for (split shares).
export const memberBreakdownQuerySchema = z
    .object({ ...rangeShape, by: z.enum(['paid', 'spent']).optional() })
    .superRefine(rangeRefine);

export type CategoryBreakdownQueryDto = z.infer<typeof categoryBreakdownQuerySchema>;
