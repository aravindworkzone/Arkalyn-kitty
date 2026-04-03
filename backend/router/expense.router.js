const express = require('express');
const router = express.Router();
const expenseController = require('../controller/expense.controller');
const auth = require('../middleware/auth.middleware');
const isAdmin = require('../middleware/admin.middleware');

router.post('/create', auth, expenseController.createExpense);
router.delete('/delete', auth, isAdmin, expenseController.deleteExpense);

module.exports = router;