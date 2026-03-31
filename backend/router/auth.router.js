const express = require('express');
const router = express.Router();
const authController = require('../controller/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/signup', authController.SignUp);
router.post('/signin', authController.SignIn);
router.post('/signout', authMiddleware, authController.SignOut);

module.exports = router;