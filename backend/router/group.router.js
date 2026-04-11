const express = require('express');
const router = express.Router();
const groupController = require('../controller/group.controller');
const {verifyToken, authorizeRole, loadGroup} = require('../middleware/auth.middleware');

router.post('/create', verifyToken, groupController.createGroup);
router.delete('/delete/:groupId', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN"), groupController.deleteGroup);
router.post('/manageadmin', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN"), groupController.manageAdmin);
router.post('/managemember', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), groupController.manageMember);
router.post('/addcontribution', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), groupController.addContribution);
router.post('/settlement', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), groupController.Settlement);

module.exports = router;