import express from 'express';
import { createCategory, deleteCategory } from '../Controller/category.controller';
import {verifyToken, authorizeRole, loadGroup} from '../Middleware/auth.middleware';
const router = express.Router();

router.post('/create', verifyToken, loadGroup,authorizeRole("SUPER_ADMIN", "ADMIN"), createCategory);
router.delete('/delete/:id', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), deleteCategory);

export default router;