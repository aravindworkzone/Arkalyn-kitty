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
}

export const sendEmail = async ({ to, subject, html, text }: MailOptions): Promise<void> => {
    if (!resend) {
        logger.warn(
            { to, subject },
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
