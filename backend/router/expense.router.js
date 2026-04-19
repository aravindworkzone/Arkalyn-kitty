const express = require('express');
const router = express.Router();
const expenseController = require('../Controller/expense.controller');
const {verifyToken, authorizeRole, loadGroup} = require('../Middleware/auth.middleware');

router.post('/create', verifyToken, loadGroup, expenseController.createExpense);
router.delete('/delete/:id', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), expenseController.deleteExpense);

module.exports = router;