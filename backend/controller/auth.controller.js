const bcrypt = require('bcrypt');
const User = require('../model/user.model');
const jwt = require('jsonwebtoken');

exports.SignUp = async (req, res) => {
    try {
        const name = req.body.name?.trim() || '';
        const email = req.body.email?.trim() || '';
        const password = req.body.password?.trim() || '';

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashPassword
        });

        await newUser.save();

        res.status(201).json({ message: 'User created successfully' });

    } catch (error) {
        res.status(500).json({ message: error.message });
        console.log(error);
    }
}

exports.SignIn = async (req, res) => {
    try {
        const email = req.body.email?.trim() || '';
        const password = req.body.password?.trim() || '';

        if (!email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const userData = {
            _id: user._id,
            name: user.name,
            email: user.email
        };

        const token = jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'Strict' });

        res.status(200).json({ message: 'User signed in successfully' });

    } catch (error) {
        res.status(500).json({ message: error.message });
        console.log(error);
    }
}

exports.SignOut = (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: 'User signed out successfully' });
}