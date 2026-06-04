import { env } from '../config/env';
import { sendContactEmail } from '../utils/email';
import { logger } from '../utils/logger';
import { AppError } from '../helpers/AppError';
import type { ContactDto } from '../validators/contact.validator';

// Delivers a contact-form submission to the app owner's inbox. There is no DB
// record — this is fire-and-deliver. If the email provider fails we surface a
// 502 so the user can retry rather than silently dropping their message.
export const submitContactService = async (payload: ContactDto): Promise<void> => {
    try {
        await sendContactEmail(env.CONTACT_EMAIL, payload);
    } catch (err) {
        logger.error({ err, kind: payload.kind }, 'Contact form email failed');
        throw new AppError('Could not send your message right now. Please try again shortly.', 502);
    }
};
