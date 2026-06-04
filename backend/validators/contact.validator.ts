import { z } from 'zod';

// Public contact form: "Ask a question" or "Report a problem". Kept strict and
// bounded because the endpoint is unauthenticated and triggers an email send.
export const contactBodySchema = z.object({
    kind: z.enum(['question', 'report']),
    name: z
        .string({ message: 'Name is required' })
        .trim()
        .min(1, 'Name is required')
        .max(80, 'Name is too long'),
    email: z
        .string({ message: 'Email is required' })
        .trim()
        .min(1, 'Email is required')
        .max(254, 'Email is too long')
        .email('Enter a valid email')
        .toLowerCase(),
    subject: z
        .string({ message: 'Subject is required' })
        .trim()
        .min(3, 'Subject is too short')
        .max(120, 'Subject is too long'),
    message: z
        .string({ message: 'Message is required' })
        .trim()
        .min(10, 'Please add a few more details')
        .max(4000, 'Message is too long'),
});

export type ContactDto = z.infer<typeof contactBodySchema>;
