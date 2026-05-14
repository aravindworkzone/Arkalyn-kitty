import express from 'express';
import { acceptInvite, rejectInvite } from '../controllers/invite.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { acceptInviteBodySchema, rejectInviteBodySchema } from '../validators/invite.validator';

const router = express.Router();

router.post('/accept', validate({ body: acceptInviteBodySchema }), verifyToken, acceptInvite);

router.post('/reject', validate({ body: rejectInviteBodySchema }), verifyToken, rejectInvite);

export default router;
