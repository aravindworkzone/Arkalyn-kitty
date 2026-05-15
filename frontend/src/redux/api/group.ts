import {api} from "./base";
import type { GroupMember } from "../../interface/member";
import type { GroupTransaction, GroupEvent, GroupCredit } from "../../interface/transaction";

export const group = api.injectEndpoints({
    endpoints: (builder) => ({
        CreateGroup : builder.mutation<any, { name: string; contribution: number; invitees: string[] }>({
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
            transformResponse: (res: { data: {group: any} }) => res.data.group,
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId },
                { type: 'Expense', id: groupId }
            ]
        }),
        getGroupMembers: builder.query<GroupMember[], string>({
            query: (credentials) => ({
                url: `/group/getgroupmembers/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: {members: GroupMember[]} }) => res.data.members,
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId }
            ]
        }),
        getLeftContributors: builder.query<GroupMember[], string>({
            query: (groupId) => ({
                url: `/group/leftcontributors/${groupId}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: { members: GroupMember[] } }) => res.data.members,
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId }
            ]
        }),
        getBasicTransaction: builder.query<any, any>({
            query: (credentials) => ({
                url: `/group/getbasictransaction/${credentials}`,
                method: 'GET'
            }),
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId }
            ]
        }),
        getTransaction: builder.query<any, any>({
            query: (credentials) => ({
                url: `/group/gettransaction/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: {transactions: GroupTransaction[]} }) => res.data.transactions,
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId }
            ]
        }),
        getAllCredits: builder.query<GroupCredit[], string>({
            query: (groupId) => ({
                url: `/group/allcredits/${groupId}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: { credits: GroupCredit[] } }) => res.data.credits,
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId }
            ]
        }),
        getEvent: builder.query<any, any>({
            query: (credentials) => ({
                url: `/group/getevent/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: {events: GroupEvent[]} }) => res.data.events,
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId }
            ]
        }),
        manageMember: builder.mutation<any, { groupId: string; action: string; Member: string; contribution?: number }>({
            query: (body) => ({ url: '/group/managemember', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        inviteMember: builder.mutation<any, { groupId: string; invitedUser: string }>({
            query: (body) => ({ url: '/group/invitemember', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        manageAdmin: builder.mutation<any, { groupId: string; action: string; member: string }>({
            query: (body) => ({ url: '/group/manageadmin', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        addContribution: builder.mutation<any, { groupId: string; contribution: number; userId?: string; description?: string }>({
            query: (body) => ({ url: '/group/addcontribution', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        settlement: builder.mutation<any, { groupId: string; settlement: number; member: string }>({
            query: (body) => ({ url: '/group/settlement', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        deleteGroup: builder.mutation<any, string>({
            query: (groupId) => ({ url: `/group/delete/${groupId}`, method: 'DELETE' }),
            invalidatesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId },
                'Group'
            ]
        }),
        leaveGroup: builder.mutation<any, string>({
            query: (groupId) => ({ url: '/group/leave', method: 'POST', body: { groupId } }),
            invalidatesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId },
                'Group'
            ]
        }),
        approveLeave: builder.mutation<any, { groupId: string; member: string; settlement: number }>({
            query: (body) => ({ url: '/group/leave/approve', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId },
                'Group'
            ]
        }),
        rejectLeave: builder.mutation<any, { groupId: string; member: string }>({
            query: (body) => ({ url: '/group/leave/reject', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        getGroupClosePreview: builder.query<{
            groupId: string;
            status: string;
            currentBalance: number;
            totalContribution: number;
            members: {
                userId: string;
                name: string;
                contribution: number;
                proportionalRefund: number;
            }[];
        }, string>({
            query: (groupId) => ({
                url: `/group/${groupId}/close-preview`,
                method: 'GET'
            }),
            transformResponse: (res: { data: { preview: any } }) => res.data.preview,
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId }
            ]
        }),
        closeGroup: builder.mutation<any, {
            groupId: string;
            overrides?: { userId: string; refundAmount: number }[];
        }>({
            query: ({ groupId, overrides }) => ({
                url: `/group/${groupId}/close`,
                method: 'POST',
                body: overrides && overrides.length > 0 ? { overrides } : {}
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId },
                'Group', 'Expense', 'Transaction', 'Event'
            ]
        }),
        toggleFavorite: builder.mutation<{ isFavorite: boolean }, { groupId: string; isFavorite: boolean }>({
            query: (body) => ({ url: '/group/favorite', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId },
                'Group', 'User'
            ]
        }),
    })
})

export const {
    useCreateGroupMutation, useGetGroupByIdQuery, useGetGroupMembersQuery,
    useGetLeftContributorsQuery,
    useGetBasicTransactionQuery, useGetTransactionQuery, useGetEventQuery,
    useGetAllCreditsQuery,
    useManageMemberMutation, useInviteMemberMutation, useManageAdminMutation, useAddContributionMutation,
    useSettlementMutation, useDeleteGroupMutation, useLeaveGroupMutation,
    useApproveLeaveMutation, useRejectLeaveMutation,
    useGetGroupClosePreviewQuery, useCloseGroupMutation,
    useToggleFavoriteMutation
} = group;