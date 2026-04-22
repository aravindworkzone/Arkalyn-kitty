import { SignUpService, SignInService } from '../Service/auth.service';
import { Request, Response } from 'express';

export const SignUp = async (req: Request, res: Response) => {
    try {
        const result = await SignUpService(req.body);

        return res.status(201).json({ message: 'User created successfully', user: result.name });
    } catch (error: any) {
        return res.status(error.statusCode).json({ message: error.message });
    }
}

export const SignIn = async (req: Request, res: Response) => {
    try {
        const result = await SignInService(req.body);

        res.cookie('AccessToken', result.token, { httpOnly: true, secure: false, sameSite: 'strict' });

        res.status(200).json({ message: 'User signed in successfully', user: result.user });

    } catch (error: any) {
        res.status(error.statusCode).json({ message: error.message });
        console.log(error);
    }
}

export const SignOut = (req: Request, res: Response) => {
    res.clearCookie('AccessToken');
    res.status(200).json({ message: 'User signed out successfully' });
}