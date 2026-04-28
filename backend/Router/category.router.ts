import express from 'express';
import { createCategory, deleteCategory, getCategoryDetails } from '../Controller/category.controller';
import {verifyToken, authorizeRole, loadGroup} from '../Middleware/auth.middleware';
const router = express.Router();

router.post('/create', verifyToken, loadGroup,authorizeRole("SUPER_ADMIN", "ADMIN"), createCategory);
router.delete('/delete/:id', verifyToken, authorizeRole("SUPER_ADMIN", "ADMIN"), deleteCategory);
router.get('/getCategoryDetails/:groupId', verifyToken, loadGroup, getCategoryDetails);

export default router;