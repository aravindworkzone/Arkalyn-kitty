import { z } from 'zod';
import { groupIdParamSchema } from './common';

export const REPORT_PRESETS = ['this_month', 'last_month', 'all_time', 'custom'] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

const isoDate = z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Invalid ISO date');

export const categoryBreakdownParamsSchema = z.object({
    groupId: groupIdParamSchema,
});

export const categoryBreakdownQuerySchema = z
    .object({
        startDate: isoDate.optional(),
        endDate: isoDate.optional(),
        preset: z.enum(REPORT_PRESETS).optional(),
    })
    .superRefine((val, ctx) => {
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
    });

export type CategoryBreakdownQueryDto = z.infer<typeof categoryBreakdownQuerySchema>;
