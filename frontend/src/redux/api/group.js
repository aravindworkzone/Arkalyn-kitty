import {api} from "./base";

export const group = api.injectEndpoints({
    endpoints: (builder) => ({
        getUserGroups: builder.query({
            query: () => '/group/usergroups',
            providesTags: ['Group']
        })
    })
});

export const { useGetUserGroupsQuery } = group;