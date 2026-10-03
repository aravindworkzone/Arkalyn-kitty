import type { NotificationType } from '../models/notification.model';

/**
 * One line of prose for a notification, server-side.
 *
 * A push notification is rendered by the OS, not by the app, so the text has to
 * be composed here — the client's i18n bundle (frontend/src/helpers/
 * notificationMessage.ts, keyed `notifications.msg.*`) is not reachable from a
 * push payload. The wording deliberately mirrors those keys so a notification
 * reads the same whether it arrives as a toast or as a system banner.
 *
 * Two consequences worth knowing: this is English-only regardless of the user's
 * in-app language, and it is a second copy that has to be updated alongside the
 * translation file when a type is added. The alternative — shipping the payload
 * untranslated and letting the service worker look it up — would mean the
 * service worker carrying its own copy of the i18n bundle.
 */
const TEMPLATES: Record<NotificationType, (actor: string, group: string) => string> = {
    GROUP_INVITE: (a, g) => `${a} invited you to ${g}`,
    INVITE_ACCEPTED: (a, g) => `${a} joined ${g}`,
    INVITE_REJECTED: (a, g) => `${a} declined the invite to ${g}`,
    JOIN_APPROVAL_REQUESTED: (a, g) => `${a} accepted an invite to ${g} and needs approval`,
    JOIN_APPROVED: (_a, g) => `You were approved to join ${g}`,
    JOIN_DECLINED: (_a, g) => `Your request to join ${g} was declined`,
    LEAVE_REQUESTED: (a, g) => `${a} requested to leave ${g}`,
    LEAVE_APPROVED: (_a, g) => `Your request to leave ${g} was approved`,
    LEAVE_REJECTED: (_a, g) => `Your request to leave ${g} was declined`,
    ROLE_CHANGED: (_a, g) => `Your role changed in ${g}`,
    MEMBER_LEFT: (a, g) => `${a} left ${g}`,
    GROUP_DELETED: (_a, g) => `${g} was deleted`,
    // The in-app bundle has no strings for these yet and falls through to its
    // generic line; push says something useful rather than repeating that.
    GROUP_LINK_REQUESTED: (a, g) => `${a} asked to link a group with ${g}`,
    GROUP_LINK_APPROVED: (a, g) => `${a} approved the group link with ${g}`,
    GROUP_LINK_REJECTED: (a, g) => `${a} declined the group link with ${g}`,
    GROUP_LINK_REVOKED: (a, g) => `${a} revoked the group link with ${g}`,
    GROUP_LINK_FUNDED: (a, g) => `${a} sent funds to ${g}`,
    GROUP_LINK_CREDIT_LIMIT_SET: (a, g) => `${a} updated the Reserve credit limit for ${g}`,
    GROUP_LINK_REPAID: (a, g) => `${a} repaid Reserve credit to ${g}`,
    CHIT_DUE_RECORDED: (_a, g) => `Your chit payment was recorded in ${g}`,
    CHIT_PAYOUT_RELEASED: (_a, g) => `Your chit payout was released in ${g}`,
};

const DEFAULT_MESSAGE = 'You have a new notification';

export interface NotificationTextInput {
    type: NotificationType;
    actorName?: string | null;
    groupName?: string | null;
}

/**
 * `group` can legitimately be empty — a notification about a deleted group
 * populates to null — so callers stamp the name into metadata and pass it here.
 */
export const notificationText = ({ type, actorName, groupName }: NotificationTextInput): string => {
    const template = TEMPLATES[type];
    if (!template) return DEFAULT_MESSAGE;

    const actor = actorName?.trim() || 'Someone';
    const group = groupName?.trim() || 'a group';
    return template(actor, group);
};

export default notificationText;
