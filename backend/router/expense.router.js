const express = require('express');
const router = express.Router();
const expenseController = require('../controller/expense.controller');
const {verifyToken, authorizeRole, loadGroup} = require('../middleware/auth.middleware');

router.post('/create', verifyToken, loadGroup, expenseController.createExpense);
router.delete('/delete/:id', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), expenseController.deleteExpense);

module.exports = router;