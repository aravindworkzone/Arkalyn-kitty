const express = require('express');
const router = express.Router();
const categoryController = require('../controller/category.controller');
const auth = require('../middleware/auth.middleware');
const isAdmin = require('../middleware/admin.middleware');

router.post('/create', auth, isAdmin, categoryController.createCategory);
router.delete('/delete', auth, isAdmin, categoryController.deleteCategory);

module.exports = router;