import { env } from '../config/env';
import { GOOGLE_TOKEN_URI } from '../config/constants';
import { AppError } from '../helpers/AppError';
import { logger } from './logger';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  refresh_token?: string;
}

const GoogleToken = async (code: string): Promise<GoogleTokenResponse> => {
    if (!code || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
        throw new AppError('Google sign-in is not configured', 500, undefined, 'oauth_misconfigured');
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URI, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: env.GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });

    if (!tokenResponse.ok) {
        const body = await tokenResponse.text().catch(() => '');
        logger.error({ status: tokenResponse.status, body }, 'Google token exchange failed');
        // 401 here means Google rejected the exchange (bad client secret, a
        // redirect_uri that doesn't match the console, or a replayed code) — it
        // says nothing about the user's email.
        throw new AppError('Google sign-in failed', 401, undefined, 'google_exchange_failed');
    }

    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokenData.id_token) {
        logger.error('Google token response contained no id_token');
        throw new AppError('Google sign-in failed', 401, undefined, 'google_exchange_failed');
    }

    return tokenData;
};

export default GoogleToken;
