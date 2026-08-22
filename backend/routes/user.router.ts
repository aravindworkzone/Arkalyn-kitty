import express from 'express';
import {
    userGroups,
    GetUser,
    VerifyUser,
    SearchUsers,
    DeleteAccount,
    GenerateApiKey,
    RevokeApiKey,
    SubscribePush,
    UnsubscribePush,
} from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { verifyEmailBodySchema } from '../validators/auth.validator';
import {
    pushSubscriptionBodySchema,
    pushUnsubscribeBodySchema,
} from '../validators/push.validator';

const router = express.Router();

router.get('/me', verifyToken, GetUser);
router.delete('/me', verifyToken, DeleteAccount);
router.get('/usergroups', verifyToken, userGroups);
router.get('/search', verifyToken, SearchUsers);
router.post('/verifyuser', validate({ body: verifyEmailBodySchema }), verifyToken, VerifyUser);

// Personal API key (read-only programmatic access via the MCP server). Both are
// JWT-cookie protected — a user manages their own key from the web app only.
router.post('/generate-api-key', verifyToken, GenerateApiKey);
router.delete('/revoke-api-key', verifyToken, RevokeApiKey);

// Web Push. The path is camelCase to match what the client already calls; the
// browser's subscription object is posted as-is.
router.post(
    '/notificationSubscription',
    verifyToken,
    validate({ body: pushSubscriptionBodySchema }),
    SubscribePush
);
router.delete(
    '/notificationSubscription',
    verifyToken,
    validate({ body: pushUnsubscribeBodySchema }),
    UnsubscribePush
);

export default router;