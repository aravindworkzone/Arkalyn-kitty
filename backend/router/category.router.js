const express = require('express');
const router = express.Router();
const categoryController = require('../controller/category.controller');
const {verifyToken, authorizeRole, loadGroup} = require('../middleware/auth.middleware');

router.post('/create', verifyToken, loadGroup,authorizeRole("SUPER_ADMIN", "ADMIN"), categoryController.createCategory);
router.delete('/delete/:id', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), categoryController.deleteCategory);

module.exports = router;