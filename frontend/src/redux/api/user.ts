import {api} from "./base";
import type { IUser } from "../../interface/user"

export interface UserSuggestion {
    _id: string;
    name: string;
    email: string;
}

export const user = api.injectEndpoints({
    endpoints: (builder) => ({
        getUserGroups: builder.query<any, void>({
            query: () => '/user/usergroups',
            providesTags: ['Group']
        }),
        searchUsers: builder.query<UserSuggestion[], string>({
            query: (q) => `/user/search?q=${encodeURIComponent(q)}`,
            transformResponse: (res: { users: UserSuggestion[] }) => res.users,
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

export const { useGetUserGroupsQuery, useSearchUsersQuery, useVerifyUserMutation } = user;
