import express from 'express';
import {
    userGroups,
    GetUser,
    VerifyUser,
    SearchUsers,
    DeleteAccount,
    GenerateApiKey,
    RevokeApiKey,
} from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { verifyEmailBodySchema } from '../validators/auth.validator';

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

export default router;
