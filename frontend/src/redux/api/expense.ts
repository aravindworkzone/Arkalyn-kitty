import {api} from './base';
import type { GetExpenseReport, Expense } from "../../interface/expense";
import type { PaginatedData, ApiSuccess } from "../../interface/api";

export interface CreateExpenseRequest {
    groupId: string;
    category: string;
    title: string;
    description?: string;
    amount: number;
    paidBy: string;
    paymentType: string;
    date: string;
    splitBetween?: { userId: string; amount: number }[];
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
    })
});

export const { useCreateExpenseMutation, useGetExpensesQuery, useGetPaymentMethodQuery, useGetExpenseReportQuery, useGetAllExpensesInfiniteQuery, useDeleteExpenseMutation } = expense;