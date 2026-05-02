import {api} from "./base";

interface Member {
    contribution: number;
    name: string;
    role : string;
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
    performedBy: string;
    metadata: {
        groupName: string;
        memberName?: undefined;
        action?: undefined;
        name?: undefined;
        member?: undefined;
        role?: undefined;
    };
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
    })
})

export const { useCreateGroupMutation, useGetGroupByIdQuery, useGetGroupMembersQuery, useGetBasicTransactionQuery, useGetTransactionQuery, useGetEventQuery } = group;