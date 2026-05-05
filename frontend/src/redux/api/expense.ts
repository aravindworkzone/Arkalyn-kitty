import {api} from './base';

interface GetExpenseReport {
    amount: number;
    category: {
        color: string;
        _id: string;
        name: string;
    };
    time: string;
    date: string;
    groupId: string;
    isDeleted: boolean;
    paidBy: {
        name: string;
        email: string;
    };
    paymentType: string;
    splitBetween: { userId: { _id: string; name: string; email: string }; amount: number }[];
    title: string;
    updatedAt: string;
    __v: number;
    _id: string;
};

export const expense = api.injectEndpoints({
    endpoints: (builder) => ({
        createExpense: builder.mutation<any, any>({
            query: (credentials) => ({
                url: '/expense/create',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: ['Expense']
        }),
        getExpenses: builder.query<any, any>({
            query: () => '/expense/getexpenses',
            providesTags: ['Expense']
        }),
        getPaymentMethod: builder.query<string[], void>({
            query: () => '/expense/paymentmethods',
            transformResponse: (res: { paymentMethods: string[] }) => res.paymentMethods,
            providesTags: ['Expense'],
        }),
        getExpenseReport: builder.query<GetExpenseReport[], any>({
            query: (credentials) => `/expense/expensereport/${credentials}`,
            transformResponse: (res: { report: GetExpenseReport[] }) => res.report,
            providesTags: ['Expense']
        }),
        getAllExpenses: builder.query<GetExpenseReport[], string>({
            query: (groupId) => `/expense/allexpenses/${groupId}`,
            transformResponse: (res: { expenses: GetExpenseReport[] }) => res.expenses,
            providesTags: ['Expense']
        }),
        deleteExpense: builder.mutation<any, { expenseId: string; groupId: string; reason?: string }>({
            query: ({ expenseId, groupId, reason }) => ({
                url: `/expense/delete/${expenseId}`,
                method: 'DELETE',
                body: { groupId, reason }
            }),
            invalidatesTags: ['Expense', 'Group']
        }),
    })
});

export const { useCreateExpenseMutation, useGetExpensesQuery, useGetPaymentMethodQuery, useGetExpenseReportQuery, useGetAllExpensesQuery, useDeleteExpenseMutation } = expense;