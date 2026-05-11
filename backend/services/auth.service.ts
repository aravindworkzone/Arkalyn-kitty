import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import { AppError } from '../helpers/AppError';
import { env } from '../config/env';
import { BCRYPT_SALT_ROUNDS, JWT_EXPIRES_IN } from '../config/constants';
import type { SignUpDto, SignInDto } from '../types/dto';

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

export const SignInService = async (data: SignInDto) => {
    const user = await User.findOne({ email: data.email });
    if (!user) throw new AppError('Invalid credentials', 401);

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) throw new AppError('Invalid credentials', 401);

    const userData = {
        _id: user._id,
        name: user.name,
        email: user.email,
    };

    const token = jwt.sign(userData, env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
        token,
        user: userData,
    };
};
