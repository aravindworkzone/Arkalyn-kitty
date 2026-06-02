import {api} from "./base";
import type { IUser } from "../../interface/user"
import type { ApiSuccess } from "../../interface/api";
import type { Group } from "../../interface/group";

export interface UserSuggestion {
    _id: string;
    name: string;
    email: string;
}

export const user = api.injectEndpoints({
    endpoints: (builder) => ({
        getUserGroups: builder.query<ApiSuccess<{ groups: Group[] }>, void>({
            query: () => '/user/usergroups',
            providesTags: ['Group']
        }),
        searchUsers: builder.query<UserSuggestion[], string>({
            query: (q) => `/user/search?q=${encodeURIComponent(q)}`,
            transformResponse: (res: { data: {users: UserSuggestion[]} }) => res.data.users,
        }),
        verifyUser: builder.mutation<IUser, string>({
            query: (email) => ({
                url: '/user/verifyuser',
                method: 'POST',
                body: { email }
            })
        }),
        deleteAccount: builder.mutation<{ success: boolean; message: string }, void>({
            query: () => ({
                url: '/user/me',
                method: 'DELETE'
            }),
            invalidatesTags: ['Auth']
        })
    })
});

export const {
    useGetUserGroupsQuery, useSearchUsersQuery, useVerifyUserMutation, useDeleteAccountMutation
} = user;
