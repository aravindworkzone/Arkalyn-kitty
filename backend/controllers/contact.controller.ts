import { submitContactService } from '../services/contact.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const SubmitContact = asyncHandler(async (req, res) => {
    await submitContactService(req.body);
    sendSuccess(res, null, "Thanks — your message has been sent. We'll get back to you soon.");
});
