import {api} from './base';
import type { GetExpenseReport, Expense } from "../../interface/expense";
import type { PaginatedData, ApiSuccess } from "../../interface/api";

export interface CreateExpenseRequest {
    groupId: string;
    category: string;
    creditCategory?: string;
    title: string;
    description?: string;
    amount: number;
    paidBy: string;
    paymentType: string;
    date: string;
    splitBetween?: { userId: string; amount: number }[];
}

export interface DuplicateCheckParams {
    groupId: string;
    amount: number;
    date: string;
    category?: string;
    excludeExpenseId?: string;
}

export interface DuplicateMatch {
    _id: string;
    title: string;
    amount: number;
    date: string;
    category: { name: string };
    createdBy: { name: string };
}

export interface DuplicateCheckResponse {
    tier: 1 | 2 | null;
    match: DuplicateMatch | null;
}

export const expense = api.injectEndpoints({
    endpoints: (builder) => ({
        createExpense: builder.mutation<ApiSuccess<{ expense: Expense }>, CreateExpenseRequest>({
            query: (credentials) => ({
                url: '/expense/create',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: "Expense", id: arg.groupId }
            ]
        }),
        updateExpense: builder.mutation<ApiSuccess<{ expense: Expense }>, CreateExpenseRequest & { expenseId: string }>({
            query: ({ expenseId, ...credentials }) => ({
                url: `/expense/update/${expenseId}`,
                method: 'PATCH',
                body: credentials
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: "Expense", id: arg.groupId },
                { type: "Expense", id: arg.expenseId },
                { type: "Group", id: arg.groupId }
            ]
        }),
        getExpenseById: builder.query<Expense, { groupId: string; expenseId: string }>({
            query: ({ groupId, expenseId }) => `/expense/one/${groupId}/${expenseId}`,
            transformResponse: (res: { data: { expense: Expense } }) => res.data.expense,
            providesTags: (_result, _error, arg) => [
                { type: "Expense", id: arg.expenseId }
            ],
        }),
        getExpenses: builder.query<unknown, string>({
            query: () => '/expense/getexpenses',
            providesTags: (_result, _error, groupId) => [
                { type: "Expense", id: groupId }
            ],
        }),
        getPaymentMethod: builder.query<string[], void>({
            query: () => '/expense/paymentmethods',
            transformResponse: (res: { data: {paymentMethods: string[]} }) => res.data.paymentMethods,
        }),
        getExpenseReport: builder.query<GetExpenseReport[], string>({
            query: (credentials) => `/expense/expensereport/${credentials}`,
            transformResponse: (res: { data: {report: GetExpenseReport[]} }) => res.data.report,
            providesTags: (_result, _error, groupId) => [
                { type: "Expense", id: groupId }
            ],
        }),
        getAllExpenses: builder.infiniteQuery<
            PaginatedData<GetExpenseReport>,
            {
                groupId: string;
                categoryId?: string;
                paidBy?: string;
                spender?: string;
                startDate?: string;
                endDate?: string;
            },
            number
        >({
            infiniteQueryOptions: {
                initialPageParam: 1,
                getNextPageParam: (lastPage, _allPages, lastPageParam) => {
                    const loaded = lastPageParam * lastPage.limit;
                    return loaded < lastPage.total ? lastPageParam + 1 : undefined;
                },
            },
            query: ({ queryArg, pageParam }) => {
                const { groupId, categoryId, paidBy, spender, startDate, endDate } = queryArg;
                const params = new URLSearchParams();
                params.set("page", String(pageParam));
                params.set("limit", "20");
                if (categoryId) params.set("categoryId", categoryId);
                if (paidBy) params.set("paidBy", paidBy);
                if (spender) params.set("spender", spender);
                if (startDate) params.set("startDate", startDate);
                if (endDate) params.set("endDate", endDate);
                return `/expense/allexpenses/${groupId}?${params.toString()}`;
            },
            transformResponse: (res: { data: PaginatedData<GetExpenseReport> }) => res.data,
            providesTags: (_result, _error, arg) => [
                { type: "Expense", id: arg.groupId }
            ],
        }),
        deleteExpense: builder.mutation<ApiSuccess<unknown>, { expenseId: string; groupId: string; reason?: string }>({
            query: ({ expenseId, groupId, reason }) => ({
                url: `/expense/delete/${expenseId}`,
                method: 'DELETE',
                body: { groupId, reason }
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: "Expense", id: arg.groupId },
                { type: "Group", id: arg.groupId }
            ]
        }),
        checkDuplicate: builder.query<DuplicateCheckResponse, DuplicateCheckParams>({
            query: ({ groupId, amount, date, category, excludeExpenseId }) => {
                const params = new URLSearchParams();
                params.set('amount', String(amount));
                params.set('date', date);
                if (category) params.set('category', category);
                if (excludeExpenseId) params.set('excludeExpenseId', excludeExpenseId);
                return `/expense/duplicate-check/${groupId}?${params.toString()}`;
            },
            transformResponse: (res: { data: DuplicateCheckResponse }) => {
                const { tier, match } = res.data;
                if (!match) return { tier, match: null };
                return {
                    tier,
                    match: { ...match, amount: match.amount / 100 },
                };
            },
        }),
    })
});

export const {
    useCreateExpenseMutation,
    useUpdateExpenseMutation,
    useGetExpenseByIdQuery,
    useGetExpensesQuery,
    useGetPaymentMethodQuery,
    useGetExpenseReportQuery,
    useGetAllExpensesInfiniteQuery,
    useDeleteExpenseMutation,
    useLazyCheckDuplicateQuery,
} = expense;