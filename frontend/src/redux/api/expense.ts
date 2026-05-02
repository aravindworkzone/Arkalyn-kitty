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
    paidBy: string;
    paymentType: string;
    splitBetween: [];
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
            query: () => '/expense/expensereport',
            transformResponse: (res: { report: GetExpenseReport[] }) => res.report,
            providesTags: ['Expense']
        })
    })
});

export const { useCreateExpenseMutation, useGetExpensesQuery, useGetPaymentMethodQuery, useGetExpenseReportQuery } = expense;