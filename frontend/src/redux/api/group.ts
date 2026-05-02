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
        })
    })
})

export const { useCreateGroupMutation, useGetGroupByIdQuery, useGetGroupMembersQuery } = group;