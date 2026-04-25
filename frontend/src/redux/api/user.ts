import {api} from "./base";
import type { IUser } from "../../interface/user"

export const user = api.injectEndpoints({
    endpoints: (builder) => ({
        getUserGroups: builder.query<any, void>({
            query: () => '/user/usergroups',
            providesTags: ['User']
        }),
        verifyUser: builder.mutation<IUser, string>({
        query: (email) => ({
            url: '/user/verifyuser',
            method: 'POST',
            body: { email }
        })
        })
    })
});

export const { useGetUserGroupsQuery, useVerifyUserMutation } = user;