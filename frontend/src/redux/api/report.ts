import { api } from './base';
import type {
    CategoryBreakdown,
    CategoryBreakdownArgs,
    MemberBreakdown,
    MemberBreakdownArgs,
    SpendTrend,
    ReportRangeArgs,
} from '../../interface/report';

// Reports all share the same preset/startDate/endDate query params.
const rangeQuery = (args: ReportRangeArgs): string => {
    const params = new URLSearchParams();
    if (args.preset) params.set('preset', args.preset);
    if (args.startDate) params.set('startDate', args.startDate);
    if (args.endDate) params.set('endDate', args.endDate);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
};

export const report = api.injectEndpoints({
    endpoints: (builder) => ({
        getCategoryBreakdown: builder.query<CategoryBreakdown, CategoryBreakdownArgs>({
            query: (args) => ({
                url: `/groupreport/${args.groupId}/reports/category-breakdown${rangeQuery(args)}`,
                method: 'GET',
            }),
            transformResponse: (res: { data: CategoryBreakdown }) => res.data,
            providesTags: (_result, _error, arg) => [
                { type: 'Expense', id: arg.groupId },
                { type: 'Category', id: arg.groupId },
                { type: 'Group', id: arg.groupId },
            ],
        }),
        getMemberBreakdown: builder.query<MemberBreakdown, MemberBreakdownArgs>({
            query: (args) => {
                const range = rangeQuery(args);
                const sep = range ? '&' : '?';
                const byParam = args.by ? `${sep}by=${args.by}` : '';
                return {
                    url: `/groupreport/${args.groupId}/reports/member-breakdown${range}${byParam}`,
                    method: 'GET',
                };
            },
            transformResponse: (res: { data: MemberBreakdown }) => res.data,
            providesTags: (_result, _error, arg) => [
                { type: 'Expense', id: arg.groupId },
                { type: 'Group', id: arg.groupId },
            ],
        }),
        getSpendTrend: builder.query<SpendTrend, ReportRangeArgs>({
            query: (args) => ({
                url: `/groupreport/${args.groupId}/reports/spend-trend${rangeQuery(args)}`,
                method: 'GET',
            }),
            transformResponse: (res: { data: SpendTrend }) => res.data,
            providesTags: (_result, _error, arg) => [
                { type: 'Expense', id: arg.groupId },
                { type: 'Group', id: arg.groupId },
            ],
        }),
    }),
});

export const {
    useGetCategoryBreakdownQuery,
    useGetMemberBreakdownQuery,
    useGetSpendTrendQuery,
} = report;
