import {api} from "./base";

interface Member {
    contribution: number;
    name: string;
    role: string;
    settlement?: boolean;
    userId: {
        _id: string
        name: string
        email: string
    };
    _id: string;
}

interface getTransaction {
    _id: string;
    action: string;
    amount: number;
    description: string;
    performedBy: {
        _id: string;
        name: string;
    };
    referenceModel: string;
    createdAt: string;
};

interface getEvent{
    _id: string;
    eventType: string;
    performedBy: {
        _id: string;
        name: string;
    };
    metadata: Record<string, any>;
    createdAt: string;
}

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
        getGroupMembers: builder.query<Member[], string>({
            query: (credentials) => ({
                url: `/group/getgroupmembers/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { members: Member[] }) => res.members,
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
            transformResponse: (res: { transactions: getTransaction }) => res.transactions,
            providesTags: ['Group']
        }),
        getEvent: builder.query<any, any>({
            query: (credentials) => ({
                url: `/group/getevent/${credentials}`,
                method: 'GET'
            }),
            transformResponse: (res: { events: getEvent }) => res.events,
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