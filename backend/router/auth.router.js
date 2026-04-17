const express = require('express');
const router = express.Router();
const authController = require('../Controller/auth.controller');
const {verifyToken} = require('../Middleware/auth.middleware');

router.post('/signup', authController.SignUp);
router.post('/signin', authController.SignIn);
router.post('/signout', verifyToken, authController.SignOut);
router.get('/user', verifyToken, authController.GetUser);

module.exports = router;