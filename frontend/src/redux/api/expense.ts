import {api} from './base';
import type { GetExpenseReport } from "../../interface/expense";

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
        getAllExpenses: builder.query<GetExpenseReport[], string>({
            query: (groupId) => `/expense/allexpenses/${groupId}`,
            transformResponse: (res: { data: {expenses: GetExpenseReport[]} }) => res.data.expenses,
            providesTags: (_result, _error, groupId) => [
                { type: "Expense", id: groupId }
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