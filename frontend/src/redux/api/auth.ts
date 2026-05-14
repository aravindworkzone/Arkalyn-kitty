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
                url: '/auth/login',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: ['Auth']
        }),
        signOut: builder.mutation<any, void>({
            query: () => ({
                url: '/auth/logout',
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