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
        }),
        forgotPassword: builder.mutation<{ success: boolean; message: string }, { email: string }>({
            query: (body) => ({
                url: '/auth/forgot-password',
                method: 'POST',
                body
            })
        }),
        resetPassword: builder.mutation<{ success: boolean; message: string }, { token: string; password: string }>({
            query: (body) => ({
                url: '/auth/reset-password',
                method: 'POST',
                body
            })
        })
    })
});

export const {
    useSignUpMutation, useSignInMutation, useSignOutMutation, useGetUserQuery,
    useForgotPasswordMutation, useResetPasswordMutation
} = auth;