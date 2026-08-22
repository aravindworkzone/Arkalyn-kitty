import mongoose from 'mongoose';
import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import PushSubscription from '../models/push_subscription.model';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Web Push delivery.
 *
 * Push is strictly an enhancement over the existing socket + stored-notification
 * path: every notification is already persisted and already emitted to any live
 * socket. So nothing here is allowed to throw into a caller — a push service
 * being slow or down must not fail the invite that triggered it.
 */

// Configured once. Without keys the module stays inert and every send is a
// no-op, which is what lets a dev machine run without VAPID configured.
const isConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (isConfigured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    logger.info('Web Push configured');
} else {
    logger.warn('VAPID keys not set — push notifications are disabled');
}

export interface PushSubscriptionInput {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

/**
 * Stores (or re-points) a browser's subscription.
 *
 * Upsert on `endpoint` rather than insert: browsers hand back the same endpoint
 * on every `subscribe()` for the same install, so a plain insert would collide
 * on the unique index every time the page loaded. The `userId` in the update is
 * what reassigns an endpoint when a different account signs in on that browser.
 */
export const saveSubscription = async (
    userId: mongoose.Types.ObjectId,
    subscription: PushSubscriptionInput
): Promise<void> => {
    await PushSubscription.updateOne(
        { endpoint: subscription.endpoint },
        { $set: { userId, keys: subscription.keys } },
        { upsert: true }
    );
};

/** Drops one browser's subscription — used when a user turns push off. */
export const removeSubscription = async (
    userId: mongoose.Types.ObjectId,
    endpoint: string
): Promise<void> => {
    await PushSubscription.deleteOne({ userId, endpoint });
};

export interface PushPayload {
    title: string;
    body: string;
    /** In-app path to open on click. */
    url?: string;
    /** Collapses same-tag notifications instead of stacking them. */
    tag?: string;
}

/**
 * Fans a payload out to every browser the user has subscribed.
 *
 * 404 and 410 mean the push service has permanently retired that endpoint (the
 * browser was uninstalled, the user cleared site data, the subscription was
 * replaced). Those rows can never deliver again, so they are deleted — left in
 * place they would accumulate forever and every future send would pay for them.
 * Any other failure is transient and the row is kept.
 */
export const sendPushToUser = async (
    userId: mongoose.Types.ObjectId | string,
    payload: PushPayload
): Promise<void> => {
    if (!isConfigured) return;

    const subscriptions = await PushSubscription.find({ userId });
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.all(
        subscriptions.map(async (sub) => {
            const target: WebPushSubscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            };

            try {
                await webpush.sendNotification(target, body);
            } catch (err) {
                const statusCode = (err as { statusCode?: number })?.statusCode;

                if (statusCode === 404 || statusCode === 410) {
                    await PushSubscription.deleteOne({ _id: sub._id });
                    logger.info({ endpoint: sub.endpoint }, 'Pruned expired push subscription');
                    return;
                }

                logger.warn(
                    { err, statusCode, endpoint: sub.endpoint },
                    'Push delivery failed'
                );
            }
        })
    );
};
