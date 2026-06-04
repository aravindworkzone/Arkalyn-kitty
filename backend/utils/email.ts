import { Resend } from 'resend';
import { env } from './../config/env';
import { logger } from './logger';

const APP_NAME = 'Arkalyn - Kitty';

// Resend's free tier sends from `onboarding@resend.dev` until the user verifies
// a domain — keep that as the default so dev/staging works out of the box.
const DEFAULT_FROM = `${APP_NAME} <onboarding@resend.dev>`;

// Email is optional infrastructure — if the API key is absent the app still
// runs; sends degrade to a logged warning so local dev can follow the flow.
const isConfigured = Boolean(env.RESEND_API_KEY);

const resend = isConfigured ? new Resend(env.RESEND_API_KEY) : null;

interface MailOptions {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
}

export const sendEmail = async ({ to, subject, html, text, replyTo }: MailOptions): Promise<void> => {
    if (!resend) {
        logger.warn(
            { to, subject, replyTo },
            'RESEND_API_KEY not configured — email not sent. Body below for local testing:'
        );
        logger.warn(text);
        return;
    }

    const from = env.RESEND_FROM || DEFAULT_FROM;

    const { error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
        // Surface the provider's error so the caller can decide whether to retry
        // or 500. The auth flow swallows email failures to avoid leaking which
        // addresses exist, so this is mostly for ops observability.
        logger.error({ err: error, to, subject }, 'Resend send failed');
        throw new Error(error.message ?? 'Failed to send email');
    }
};

export const sendPasswordResetEmail = async (to: string, resetUrl: string): Promise<void> => {
    const subject = `Reset your ${APP_NAME} password`;

    const text = [
        `You requested a password reset for your ${APP_NAME} account.`,
        '',
        'Open this link to set a new password (valid for 30 minutes):',
        resetUrl,
        '',
        "If you didn't request this, you can safely ignore this email — your password stays unchanged.",
    ].join('\n');

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="margin:0 0 16px">Reset your password</h2>
      <p style="margin:0 0 16px;line-height:1.5">
        You requested a password reset for your ${APP_NAME} account.
        Click the button below to set a new password. This link is valid for 30 minutes.
      </p>
      <p style="margin:0 0 24px">
        <a href="${resetUrl}"
           style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;
                  padding:12px 22px;border-radius:10px;font-weight:600">
          Reset password
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:12px;color:#666">
        Or paste this link into your browser:
      </p>
      <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#7c3aed">${resetUrl}</p>
      <p style="margin:0;font-size:12px;color:#666;line-height:1.5">
        If you didn't request this, you can safely ignore this email — your password stays unchanged.
      </p>
    </div>`;

    await sendEmail({ to, subject, html, text });
};

export type ContactKind = 'question' | 'report';

interface ContactPayload {
    kind: ContactKind;
    name: string;
    email: string;
    subject: string;
    message: string;
}

const escapeHtml = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

// Sends a contact-form submission ("Ask a question" / "Report a problem") to the
// app owner's inbox. `replyTo` is set to the submitter so the owner can reply
// straight from their mail client.
export const sendContactEmail = async (to: string, payload: ContactPayload): Promise<void> => {
    const label = payload.kind === 'report' ? 'Problem report' : 'Question';
    const subject = `[${label}] ${payload.subject}`;

    const text = [
        `New ${label.toLowerCase()} from the ${APP_NAME} app.`,
        '',
        `From: ${payload.name} <${payload.email}>`,
        `Subject: ${payload.subject}`,
        '',
        payload.message,
    ].join('\n');

    const accent = payload.kind === 'report' ? '#dc2626' : '#7c3aed';
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
      <p style="display:inline-block;margin:0 0 16px;padding:4px 12px;border-radius:999px;
                background:${accent}1a;color:${accent};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">
        ${label}
      </p>
      <h2 style="margin:0 0 16px;font-size:18px">${escapeHtml(payload.subject)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px">
        <tr>
          <td style="padding:6px 0;color:#666;width:70px">From</td>
          <td style="padding:6px 0;font-weight:600">${escapeHtml(payload.name)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666">Email</td>
          <td style="padding:6px 0">
            <a href="mailto:${escapeHtml(payload.email)}" style="color:${accent};text-decoration:none">${escapeHtml(payload.email)}</a>
          </td>
        </tr>
      </table>
      <div style="white-space:pre-wrap;line-height:1.6;background:#f6f6f7;border-radius:10px;padding:16px;font-size:14px">${escapeHtml(payload.message)}</div>
      <p style="margin:20px 0 0;font-size:12px;color:#999">Reply directly to this email to respond to ${escapeHtml(payload.name)}.</p>
    </div>`;

    await sendEmail({ to, subject, html, text, replyTo: payload.email });
};
