const express = require('express');
const router = express.Router();
const groupController = require('../controller/group.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/create', authMiddleware, groupController.createGroup);
router.delete('/delete/:id', authMiddleware, groupController.deleteGroup);

module.exports = router;