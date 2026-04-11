const express = require('express');
const router = express.Router();
const categoryController = require('../controller/category.controller');
const {verifyToken, authorizeRole, loadGroup} = require('../middleware/auth.middleware');

router.post('/create', verifyToken, loadGroup, categoryController.createCategory);
router.delete('/delete', verifyToken, authorizeRole("SUPER_ADMIN", "ADMIN"), loadGroup, categoryController.deleteCategory);

module.exports = router;