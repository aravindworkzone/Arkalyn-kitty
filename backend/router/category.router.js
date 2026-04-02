const express = require('express');
const router = express.Router();
const categoryController = require('../controller/category.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/create', authMiddleware, categoryController.createCategory);
router.delete('/delete/:id', authMiddleware, categoryController.deleteCategory);

module.exports = router;