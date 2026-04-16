const express = require('express');
const router = express.Router();
const categoryController = require('../Controller/category.controller');
const {verifyToken, authorizeRole, loadGroup} = require('../Middleware/auth.middleware');

router.post('/create', verifyToken, loadGroup,authorizeRole("SUPER_ADMIN", "ADMIN"), categoryController.createCategory);
router.delete('/delete/:id', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), categoryController.deleteCategory);

module.exports = router;