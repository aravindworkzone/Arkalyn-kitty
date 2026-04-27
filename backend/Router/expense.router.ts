import express from 'express';
import { createExpense, deleteExpense, getExpenseAddDetails } from '../Controller/expense.controller';
import {verifyToken, authorizeRole, loadGroup} from '../Middleware/auth.middleware';
const router = express.Router();

router.post('/create', verifyToken, loadGroup, createExpense);
router.delete('/delete/:id', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), deleteExpense);
router.get('/getExpenseAddDetails/:groupId', verifyToken, loadGroup, getExpenseAddDetails);

export default router;