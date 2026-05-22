import {api} from './base';
import type { GetExpenseReport } from "../../interface/expense";
import type { PaginatedData } from "../../interface/api";

export const expense = api.injectEndpoints({
    endpoints: (builder) => ({
        createExpense: builder.mutation<any, any>({
            query: (credentials) => ({
                url: '/expense/create',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: "Expense", id: arg.groupId }
            ]
        }),
        getExpenses: builder.query<any, any>({
            query: () => '/expense/getexpenses',
            providesTags: (_result, _error, groupId) => [
                { type: "Expense", id: groupId }
            ],
        }),
        getPaymentMethod: builder.query<string[], void>({
            query: () => '/expense/paymentmethods',
            transformResponse: (res: { data: {paymentMethods: string[]} }) => res.data.paymentMethods,
        }),
        getExpenseReport: builder.query<GetExpenseReport[], any>({
            query: (credentials) => `/expense/expensereport/${credentials}`,
            transformResponse: (res: { data: {report: GetExpenseReport[]} }) => res.data.report,
            providesTags: (_result, _error, groupId) => [
                { type: "Expense", id: groupId }
            ],
        }),
        getAllExpenses: builder.query<
            PaginatedData<GetExpenseReport>,
            {
                groupId: string;
                limit: number;
                categoryId?: string;
                paidBy?: string;
                startDate?: string;
                endDate?: string;
            }
        >({
            query: ({ groupId, limit, categoryId, paidBy, startDate, endDate }) => {
                const params = new URLSearchParams();
                params.set("limit", String(limit));
                if (categoryId) params.set("categoryId", categoryId);
                if (paidBy) params.set("paidBy", paidBy);
                if (startDate) params.set("startDate", startDate);
                if (endDate) params.set("endDate", endDate);
                return `/expense/allexpenses/${groupId}?${params.toString()}`;
            },
            transformResponse: (res: { data: PaginatedData<GetExpenseReport> }) => res.data,
            providesTags: (_result, _error, arg) => [
                { type: "Expense", id: arg.groupId }
            ],
        }),
        deleteExpense: builder.mutation<any, { expenseId: string; groupId: string; reason?: string }>({
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

export const { useCreateExpenseMutation, useGetExpensesQuery, useGetPaymentMethodQuery, useGetExpenseReportQuery, useGetAllExpensesQuery, useDeleteExpenseMutation } = expense;