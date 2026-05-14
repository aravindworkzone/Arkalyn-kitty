import { api } from './base';
import type { CategoryBreakdown, CategoryBreakdownArgs } from '../../interface/report';

export const report = api.injectEndpoints({
    endpoints: (builder) => ({
        getCategoryBreakdown: builder.query<CategoryBreakdown, CategoryBreakdownArgs>({
            query: ({ groupId, preset, startDate, endDate }) => {
                const params = new URLSearchParams();
                if (preset) params.set('preset', preset);
                if (startDate) params.set('startDate', startDate);
                if (endDate) params.set('endDate', endDate);
                const qs = params.toString();
                return {
                    url: `/group/${groupId}/reports/category-breakdown${qs ? `?${qs}` : ''}`,
                    method: 'GET',
                };
            },
            transformResponse: (res: { data: CategoryBreakdown }) => res.data,
            providesTags: (_result, _error, arg) => [
                { type: 'Expense', id: arg.groupId },
                { type: 'Category', id: arg.groupId },
                { type: 'Group', id: arg.groupId },
            ],
        }),
    }),
});

export const { useGetCategoryBreakdownQuery } = report;
