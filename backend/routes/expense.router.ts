import express from 'express';
import { createExpense, deleteExpense, getExpenseAddDetails, paymentMethods, expenseReport, getAllExpenses } from '../controllers/expense.controller';
import {verifyToken, authorizeRole, loadGroup} from '../middlewares/auth.middleware';
const router = express.Router();

router.post('/create', verifyToken, loadGroup, createExpense);
router.delete('/delete/:id', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), deleteExpense);
router.get('/getExpenseAddDetails/:groupId', verifyToken, loadGroup, getExpenseAddDetails);
router.get('/paymentMethods', verifyToken, paymentMethods);
router.get('/expensereport/:groupId', verifyToken, loadGroup, expenseReport);
router.get('/allexpenses/:groupId', verifyToken, loadGroup, getAllExpenses);

export default router;