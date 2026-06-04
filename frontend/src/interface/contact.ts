// Public contact form — "Ask a question" or "Report a problem". Mirrors
// backend/validators/contact.validator.ts.

export type ContactKind = 'question' | 'report';

export interface ContactRequest {
    kind: ContactKind;
    name: string;
    email: string;
    subject: string;
    message: string;
}
