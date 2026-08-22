import mongoose from 'mongoose';
import Notification, { type NotificationType } from '../models/notification.model';
import { emitToUser } from '../sockets';
import { SOCKET_EVENTS } from '../sockets/events';
import { sendPushToUser } from './push.service';
import { notificationText } from '../utils/notificationText';
import { logger } from '../utils/logger';

export interface CreateNotificationPayload {
    recipient: mongoose.Types.ObjectId | string;
    actor: mongoose.Types.ObjectId | string;
    group: mongoose.Types.ObjectId | string;
    type: NotificationType;
    metadata?: Record<string, unknown>;
}

/**
 * Persists a notification and, if the recipient has a live socket connection,
 * pushes it over the `notification:new` event. Notifications are non-critical:
 * a single-collection write, no Mongoose session.
 */
export const createNotification = async (payload: CreateNotificationPayload): Promise<void> => {
    const notification = await Notification.create({
        recipient: payload.recipient,
        actor: payload.actor,
        group: payload.group,
        type: payload.type,
        metadata: payload.metadata ?? {},
    });

    // Populated to the same shape GET /notifications returns, so the client can
    // render the pushed notification directly — the toast that pops on arrival
    // names the actor and the group, and ObjectIds would leave it with nothing
    // but the generic fallback text. A deleted group populates to null, which
    // the client already handles by falling back to metadata.groupName.
    await notification.populate([
        { path: 'actor', select: 'name' },
        { path: 'group', select: 'name' },
    ]);

    // Recipient's personal socket room is keyed by their userId string.
    // If they're offline the room is empty and this is a harmless no-op.
    emitToUser(String(payload.recipient), SOCKET_EVENTS.NOTIFICATION_NEW, notification.toJSON());

    // Push covers the case the socket cannot: the tab is closed. It is the last
    // thing here and deliberately not awaited into the caller's critical path —
    // the notification is already saved and already emitted, so a push service
    // being slow must not hold up (or fail) the invite that triggered it.
    const actor = notification.actor as unknown as { name?: string } | null;
    const group = notification.group as unknown as { name?: string } | null;
    const groupName =
        group?.name ??
        (typeof payload.metadata?.groupName === 'string' ? payload.metadata.groupName : null);

    void sendPushToUser(payload.recipient, {
        title: groupName || 'Arkalyn Kitty',
        body: notificationText({ type: payload.type, actorName: actor?.name, groupName }),
        url: '/notifications',
        // One live notification per group at a time in the OS tray: a burst of
        // group activity should not bury the rest of the user's shade.
        tag: `group:${String(payload.group)}`,
    }).catch((err) => logger.warn({ err }, 'Push fan-out failed'));
};
