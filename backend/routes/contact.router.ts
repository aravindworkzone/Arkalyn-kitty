import express from 'express';
import { SubmitContact } from '../controllers/contact.controller';
import { validate } from '../middlewares/validate.middleware';
import { contactRateLimiter } from '../middlewares/security.middleware';
import { contactBodySchema } from '../validators/contact.validator';

const router = express.Router();

// Public — no auth. Tight rate limit because it sends email.
router.post('/', contactRateLimiter, validate({ body: contactBodySchema }), SubmitContact);

export default router;
