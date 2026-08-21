import mongoose from 'mongoose';
import Notification, { type NotificationType } from '../models/notification.model';
import { emitToUser } from '../sockets';
import { SOCKET_EVENTS } from '../sockets/events';

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
};
