import {api} from "./base";
import type { ApiSuccess } from "../../interface/api";
import type { CurrentUser } from "../../interface/user";

interface SignUpRequest { name: string; email: string; password: string }
interface SignInRequest { email: string; password: string }

export const auth = api.injectEndpoints({
    endpoints: (builder) => ({
        signUp: builder.mutation<ApiSuccess<{ user: CurrentUser }>, SignUpRequest>({
            query: (credentials) => ({
                url: '/auth/signup',
                method: 'POST',
                body: credentials
            })
        }),
        signIn: builder.mutation<ApiSuccess<{ user: CurrentUser }>, SignInRequest>({
            query: (credentials) => ({
                url: '/auth/login',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: ['Auth']
        }),
        signOut: builder.mutation<ApiSuccess<null>, void>({
            query: () => ({
                url: '/auth/logout',
                method: 'POST'
            }),
            invalidatesTags: ['Auth']
        }),
        getUser: builder.query<ApiSuccess<{ user: CurrentUser }>, void>({
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
        }),
        changePassword: builder.mutation<{ success: boolean; message: string }, { currentPassword: string; newPassword: string }>({
            query: (body) => ({
                url: '/auth/change-password',
                method: 'POST',
                body
            }),
            invalidatesTags: ['Auth']
        })
    })
});

export const {
    useSignUpMutation, useSignInMutation, useSignOutMutation, useGetUserQuery,
    useForgotPasswordMutation, useResetPasswordMutation, useChangePasswordMutation
} = auth;