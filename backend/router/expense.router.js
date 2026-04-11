const express = require('express');
const router = express.Router();
const expenseController = require('../controller/expense.controller');
const {verifyToken, authorizeRole, loadGroup} = require('../middleware/auth.middleware');

router.post('/create', verifyToken, expenseController.createExpense);
router.delete('/delete', verifyToken, authorizeRole("SUPER_ADMIN", "ADMIN"), loadGroup, expenseController.deleteExpense);

module.exports = router;