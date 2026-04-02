const express = require('express');
const router = express.Router();
const expenseController = require('../controller/expense.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/create', authMiddleware, expenseController.createExpense);

module.exports = router;