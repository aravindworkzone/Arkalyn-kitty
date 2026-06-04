import {api} from "./base";
import type { GroupMember } from "../../interface/member";
import type { GroupTransaction, GroupEvent, GroupCredit, BasicTransactionTotals } from "../../interface/transaction";
import type { PaginatedData, ApiSuccess } from "../../interface/api";
import type { Group } from "../../interface/group";

// Refund preview returned by GET /group/:id/close-preview.
export interface GroupClosePreview {
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
}

export const group = api.injectEndpoints({
    endpoints: (builder) => ({
        CreateGroup : builder.mutation<ApiSuccess<{ group: Group }>, { name: string; contribution: number; invitees: string[]; purpose: string }>({
            query: (credentials) => ({
                url: '/group/create',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: ['Group']
        }),
        CloneGroup : builder.mutation<ApiSuccess<{ group: Group }>, { sourceGroupId: string; name: string }>({
            query: ({ sourceGroupId, name }) => ({
                url: `/group/${sourceGroupId}/clone`,
                method: 'POST',
                body: { name }
            }),
            invalidatesTags: ['Group']
        }),
        getGroupById: builder.query<Group, string>({
            query: (credentials) => ({
                url: `/group/getgroupbyid/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: {group: Group} }) => res.data.group,
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
        getBasicTransaction: builder.query<BasicTransactionTotals, string>({
            query: (groupId) => ({
                url: `/group/getbasictransaction/${groupId}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: { transactions: BasicTransactionTotals } }) => res.data.transactions,
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId }
            ]
        }),
        getTransaction: builder.query<PaginatedData<GroupTransaction>, { groupId: string; limit: number }>({
            query: ({ groupId, limit }) => ({
                url: `/group/gettransaction/${groupId}?limit=${limit}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: PaginatedData<GroupTransaction> }) => res.data,
            providesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        getAllCredits: builder.query<PaginatedData<GroupCredit>, { groupId: string; limit: number }>({
            query: ({ groupId, limit }) => ({
                url: `/group/allcredits/${groupId}?limit=${limit}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: PaginatedData<GroupCredit> }) => res.data,
            providesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        removeCredit: builder.mutation<ApiSuccess<null>, { creditId: string; groupId: string; reason?: string }>({
            query: ({ creditId, groupId, reason }) => ({
                url: `/group/credit/${creditId}`,
                method: 'DELETE',
                body: { groupId, reason }
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        getEvent: builder.query<GroupEvent[], string>({
            query: (credentials) => ({
                url: `/group/getevent/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: {events: GroupEvent[]} }) => res.data.events,
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId }
            ]
        }),
        manageMember: builder.mutation<ApiSuccess<null>, { groupId: string; action: string; Member: string; contribution?: number }>({
            query: (body) => ({ url: '/group/managemember', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        inviteMember: builder.mutation<ApiSuccess<null>, { groupId: string; invitedUser: string }>({
            query: (body) => ({ url: '/group/invitemember', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        manageAdmin: builder.mutation<ApiSuccess<null>, { groupId: string; action: string; member: string }>({
            query: (body) => ({ url: '/group/manageadmin', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        addContribution: builder.mutation<ApiSuccess<null>, { groupId: string; contribution: number; userId?: string; description?: string }>({
            query: (body) => ({ url: '/group/addcontribution', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        settlement: builder.mutation<ApiSuccess<null>, { groupId: string; settlement: number; member: string }>({
            query: (body) => ({ url: '/group/settlement', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        deleteGroup: builder.mutation<ApiSuccess<null>, string>({
            query: (groupId) => ({ url: `/group/delete/${groupId}`, method: 'DELETE' }),
            invalidatesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId },
                'Group'
            ]
        }),
        leaveGroup: builder.mutation<ApiSuccess<null>, { groupId: string; mode?: 'settlement' | 'forfeit' }>({
            query: ({ groupId, mode }) => ({
                url: '/group/leave',
                method: 'POST',
                body: mode ? { groupId, mode } : { groupId },
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId },
                'Group'
            ]
        }),
        approveLeave: builder.mutation<ApiSuccess<null>, { groupId: string; member: string; settlement: number }>({
            query: (body) => ({ url: '/group/leave/approve', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId },
                'Group'
            ]
        }),
        rejectLeave: builder.mutation<ApiSuccess<null>, { groupId: string; member: string }>({
            query: (body) => ({ url: '/group/leave/reject', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        cancelOwnLeave: builder.mutation<ApiSuccess<null>, { groupId: string }>({
            query: (body) => ({ url: '/group/leave/cancel', method: 'POST', body }),
            invalidatesTags: (_result, _error, arg) => [
                { type: 'Group', id: arg.groupId }
            ]
        }),
        getGroupClosePreview: builder.query<GroupClosePreview, string>({
            query: (groupId) => ({
                url: `/group/${groupId}/close-preview`,
                method: 'GET'
            }),
            transformResponse: (res: { data: { preview: GroupClosePreview } }) => res.data.preview,
            providesTags: (_result, _error, groupId) => [
                { type: 'Group', id: groupId }
            ]
        }),
        closeGroup: builder.mutation<ApiSuccess<unknown>, {
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
    useCreateGroupMutation, useCloneGroupMutation, useGetGroupByIdQuery, useGetGroupMembersQuery,
    useGetLeftContributorsQuery,
    useGetBasicTransactionQuery, useGetTransactionQuery, useGetEventQuery,
    useGetAllCreditsQuery, useRemoveCreditMutation,
    useManageMemberMutation, useInviteMemberMutation, useManageAdminMutation, useAddContributionMutation,
    useSettlementMutation, useDeleteGroupMutation, useLeaveGroupMutation,
    useApproveLeaveMutation, useRejectLeaveMutation, useCancelOwnLeaveMutation,
    useGetGroupClosePreviewQuery, useCloseGroupMutation,
    useToggleFavoriteMutation
} = group;
