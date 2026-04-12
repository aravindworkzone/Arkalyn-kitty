const express = require('express');
const router = express.Router();
const authController = require('../controller/auth.controller');
const {verifyToken} = require('../middleware/auth.middleware');

router.post('/signup', authController.SignUp);
router.post('/signin', authController.SignIn);
router.post('/signout', verifyToken, authController.SignOut);
router.get('/user', verifyToken, authController.GetUser);

module.exports = router;