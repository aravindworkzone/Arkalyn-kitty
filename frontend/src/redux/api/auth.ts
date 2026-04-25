import {api} from "./base";

export const auth = api.injectEndpoints({
    endpoints: (builder) => ({
        signUp: builder.mutation({
            query: (credentials) => ({
                url: '/auth/signup',
                method: 'POST',
                body: credentials
            })
        }),
        signIn: builder.mutation({
            query: (credentials) => ({
                url: '/auth/signin',
                method: 'POST',
                body: credentials
            })
        }),
        signOut: builder.mutation({
            query: () => ({
                url: '/auth/signout',
                method: 'POST'
            }),
            invalidatesTags: ['Auth']
        }),
        getUser: builder.query<any, void>({
            query: () => '/user/me',
            providesTags: ['Auth']
        })
    })
});

export const { useSignUpMutation, useSignInMutation, useSignOutMutation, useGetUserQuery } = auth;