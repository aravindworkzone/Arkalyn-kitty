const express = require('express');
const router = express.Router();
const groupController = require('../controller/group.controller');
const auth = require('../middleware/auth.middleware');
const isSuperAdmin = require('../middleware/superadmin.middleware');

router.post('/create', auth, groupController.createGroup);
router.delete('/delete', auth, isSuperAdmin, groupController.deleteGroup);
router.post('/addadmin', auth, isSuperAdmin, groupController.addGroupAdmin);
router.post('/removeadmin', auth, isSuperAdmin, groupController.removeGroupAdmin);

module.exports = router;