import {api} from "./base";

export const auth = api.injectEndpoints({
    endpoints: (builder) => ({
        signUp: builder.mutation({
            query: (credentials) => ({
                url: '/auth/signup',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: ['Auth']
        }),
        signIn: builder.mutation({
            query: (credentials) => ({
                url: '/auth/signin',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: ['Auth']
        }),
        signOut: builder.mutation({
            query: () => ({
                url: '/auth/signout',
                method: 'POST'
            }),
            providesTags: ['Auth']
        })
    })
});

export const { useSignUpMutation, useSignInMutation, useSignOutMutation } = auth;