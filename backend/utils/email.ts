import nodemailer from 'nodemailer';
import { env } from './../config/env';
import { logger } from './logger';

const APP_NAME = 'Expense Tracker';

// Email is optional infrastructure — if SMTP creds are absent the app still
// runs; sends degrade to a logged warning so local dev can follow the flow.
const isConfigured = Boolean(env.SMTP_USER && env.SMTP_PASS);

const transporter = isConfigured
    ? nodemailer.createTransport({
          service: 'gmail',
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null;

interface MailOptions {
    to: string;
    subject: string;
    html: string;
    text: string;
}

export const sendEmail = async ({ to, subject, html, text }: MailOptions): Promise<void> => {
    if (!transporter) {
        logger.warn(
            { to, subject },
            'SMTP not configured (SMTP_USER / SMTP_PASS) — email not sent. Body below for local testing:'
        );
        logger.warn(text);
        return;
    }

    await transporter.sendMail({
        from: `"${APP_NAME}" <${env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
    });
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
