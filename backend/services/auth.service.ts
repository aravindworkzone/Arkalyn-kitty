import bcrypt from 'bcrypt';
import User from '../models/user.model';
import { AppError } from '../helpers/AppError';
import { BCRYPT_SALT_ROUNDS } from '../config/constants';
import type { SignUpDto, SignInDto } from '../types/dto';
import { issueTokensForUser, rotateSession, revokeSession, IssuedTokens } from './session.service';

const DEFAULT_ROLE = 'user';

export const SignUpService = async (data: SignUpDto) => {
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    const newUser = await User.create({
        name: data.name,
        email: data.email,
        password: hashedPassword,
    });

    return {
        name: newUser.name,
        email: newUser.email,
    };
};

export interface LoginResult {
    user: { _id: string; name: string; email: string };
    tokens: IssuedTokens;
}

export const LoginService = async (
    data: SignInDto,
    deviceInfo: string
): Promise<LoginResult> => {
    const user = await User.findOne({ email: data.email });
    if (!user) throw new AppError('Invalid credentials', 401);

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) throw new AppError('Invalid credentials', 401);

    const tokens = await issueTokensForUser(
        user._id as import('mongoose').Types.ObjectId,
        DEFAULT_ROLE,
        deviceInfo
    );

    return {
        user: {
            _id: (user._id as import('mongoose').Types.ObjectId).toString(),
            name: user.name,
            email: user.email,
        },
        tokens,
    };
};

export const RefreshService = async (
    rawRefreshToken: string,
    deviceInfo: string
): Promise<IssuedTokens> => {
    return rotateSession(rawRefreshToken, DEFAULT_ROLE, deviceInfo);
};

export const LogoutService = async (rawRefreshToken: string | undefined): Promise<void> => {
    if (!rawRefreshToken) return;
    await revokeSession(rawRefreshToken);
};
