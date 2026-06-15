import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User, { IUser } from '../models/user.model';
import { AppError } from '../helpers/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { apiKeyPrefixOf, API_KEY_PREFIX_LABEL } from '../helpers/apiKey';

// Authenticates a request by its `x-api-key` header (used by the MCP server and
// any programmatic, read-only client). Mirrors verifyToken's contract: on
// success it attaches a minimal `req.user` ({ _id, role }); on any failure it
// throws 401 with a generic message — never revealing whether the key existed.
//
// Lookup is two-step because bcrypt hashes are non-deterministic and can't be
// queried directly: narrow by the plaintext `apiKeyPrefix` (indexed), then
// bcrypt.compare against each candidate. Distinct keys make collisions on the
// 8-random-char prefix astronomically unlikely, but we still loop to stay
// correct if two ever share one.
export const apiKeyAuth = asyncHandler(async (req, _res, next) => {
    const header = req.header('x-api-key');
    const key = typeof header === 'string' ? header.trim() : '';

    if (!key || !key.startsWith(API_KEY_PREFIX_LABEL)) {
        throw new AppError('Invalid or missing API key', 401);
    }

    const candidates = await User.find({
        apiKeyPrefix: apiKeyPrefixOf(key),
        status: 'ACTIVE',
    }).select('+apiKey role status');

    let matched: IUser | null = null;
    for (const candidate of candidates) {
        if (candidate.apiKey && (await bcrypt.compare(key, candidate.apiKey))) {
            matched = candidate;
            break;
        }
    }

    if (!matched) {
        throw new AppError('Invalid or missing API key', 401);
    }

    req.user = {
        _id: new mongoose.Types.ObjectId(matched._id as mongoose.Types.ObjectId),
        role: matched.role,
    } as unknown as IUser;

    next();
});
