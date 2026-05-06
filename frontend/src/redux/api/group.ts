import {api} from "./base";
import type { GroupMember } from "../../interface/member";
import type { GroupTransaction, GroupEvent } from "../../interface/transaction";

export const group = api.injectEndpoints({
    endpoints: (builder) => ({
        CreateGroup : builder.mutation<any, any>({
            query: (credentials) => ({
                url: '/group/create',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: ['Group']
        }),
        getGroupById: builder.query<any, any>({
            query: (credentials) => ({
                url: `/group/getgroupbyid/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { group: any }) => res.group,
            providesTags: ['Group']
        }),
        getGroupMembers: builder.query<GroupMember[], string>({
            query: (credentials) => ({
                url: `/group/getgroupmembers/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { members: GroupMember[] }) => res.members,
            providesTags: ['Group']
        }),
        getBasicTransaction: builder.query<any, any>({
            query: (credentials) => ({
                url: `/group/getbasictransaction/${credentials}`,
                method: 'GET'
            }),
            providesTags: ['Group']
        }),
        getTransaction: builder.query<any, any>({
            query: (credentials) => ({
                url: `/group/gettransaction/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { transactions: GroupTransaction }) => res.transactions,
            providesTags: ['Group']
        }),
        getEvent: builder.query<any, any>({
            query: (credentials) => ({
                url: `/group/getevent/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { events: GroupEvent }) => res.events,
            providesTags: ['Group']
        }),
        manageMember: builder.mutation<any, { groupId: string; action: string; Member: string; contribution?: number }>({
            query: (body) => ({ url: '/group/managemember', method: 'POST', body }),
            invalidatesTags: ['Group']
        }),
        manageAdmin: builder.mutation<any, { groupId: string; action: string; member: string }>({
            query: (body) => ({ url: '/group/manageadmin', method: 'POST', body }),
            invalidatesTags: ['Group']
        }),
        addContribution: builder.mutation<any, { groupId: string; contribution: number; userId?: string }>({
            query: (body) => ({ url: '/group/addcontribution', method: 'POST', body }),
            invalidatesTags: ['Group']
        }),
        settlement: builder.mutation<any, { groupId: string; settlement: number; member: string }>({
            query: (body) => ({ url: '/group/settlement', method: 'POST', body }),
            invalidatesTags: ['Group']
        }),
        deleteGroup: builder.mutation<any, string>({
            query: (groupId) => ({ url: `/group/delete/${groupId}`, method: 'DELETE' }),
            invalidatesTags: ['Group']
        }),
    })
})

export const {
    useCreateGroupMutation, useGetGroupByIdQuery, useGetGroupMembersQuery,
    useGetBasicTransactionQuery, useGetTransactionQuery, useGetEventQuery,
    useManageMemberMutation, useManageAdminMutation, useAddContributionMutation,
    useSettlementMutation, useDeleteGroupMutation
} = group;