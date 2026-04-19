const express = require('express');
const router = express.Router();
const groupController = require('../Controller/group.controller');
const {verifyToken, authorizeRole, loadGroup} = require('../Middleware/auth.middleware');

router.post('/create', verifyToken, groupController.createGroup);
router.delete('/delete/:groupId', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN"), groupController.deleteGroup);
router.post('/managemember', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), groupController.manageMember);
// router.post('/manageadmin', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN"), groupController.manageAdmin);
// router.post('/addcontribution', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), groupController.addContribution);
// router.post('/settlement', verifyToken, loadGroup, authorizeRole("SUPER_ADMIN", "ADMIN"), groupController.Settlement);
// router.get('/usergroups', verifyToken, groupController.userGroups);

module.exports = router;