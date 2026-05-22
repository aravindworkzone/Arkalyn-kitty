import { z } from 'zod';

export const signUpBodySchema = z.object({
    name: z
        .string({ message: 'Name is required' })
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(60, 'Name must be at most 60 characters'),
    email: z
        .string({ message: 'Email is required' })
        .trim()
        .toLowerCase()
        .email('Invalid email format'),
    password: z
        .string({ message: 'Password is required' })
        .min(6, 'Password must be at least 6 characters')
        .max(128, 'Password is too long'),
});

export const signInBodySchema = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

export const verifyEmailBodySchema = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email format'),
});

export const forgotPasswordBodySchema = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email format'),
});

export const resetPasswordBodySchema = z.object({
    token: z.string().trim().min(1, 'Reset token is required'),
    password: z
        .string({ message: 'Password is required' })
        .min(6, 'Password must be at least 6 characters')
        .max(128, 'Password is too long'),
});

export type SignUpDto = z.infer<typeof signUpBodySchema>;
export type SignInDto = z.infer<typeof signInBodySchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordBodySchema>;
