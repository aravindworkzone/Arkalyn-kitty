import bcrypt from 'bcrypt';
import User from '../Model/user.model';
import { AppError } from '../Utils/AppError';
import jwt from 'jsonwebtoken';

export const SignUpService = async (data: { name: string; email: string; password: string }) => {
    const name = data.name?.trim() || '';
    const email = data.email?.trim() || '';
    const password = data.password?.trim() || '';

    if (!name || !email || !password) {
        throw AppError('All fields are required', 400);
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw AppError('Invalid email format', 400);
    }

    if (password.length < 6) {
        throw AppError('Password must be at least 6 characters long', 400);
    }

    const hashPassword = await bcrypt.hash(password, 10);

    try {
        const newUser = await User.create({
            name,
            email,
            password: hashPassword
        });

        return {
            name: newUser.name,
            email: newUser.email
        };
    } catch (error: any) {
        if (error.code === 11000) {
            throw AppError('Email already exists', 400);
        }
        throw error;
    }
}

export const SignInService = async (data: { email: string; password: string }) => {
    const email = data.email?.trim() || '';
    const password = data.password?.trim() || '';

    if (!email || !password) {
        throw AppError('All fields are required', 400);
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw AppError('Invalid email format', 400);
    }

    if (password.length < 6) {
        throw AppError('Password must be at least 6 characters long', 400);
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw AppError('User not found', 400);
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
        throw AppError('Invalid password', 400);
    }

    const userData = {
        _id: user._id,
        name: user.name,
        email: user.email
    };

    const token = jwt.sign(userData, process.env.JWT_SECRET as string, { expiresIn: '1d' });

    return {    
        token,
        user: userData
    };
}

// exports.GetUser = async (req, res) => {
//     try {
//         res.status(200).json({ message: 'User fetched successfully', user: req.user });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// }