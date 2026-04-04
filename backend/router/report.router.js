const express = require("express");
const router = express.Router();
const reportController = require('../controller/report.controller');
const auth = require('../middleware/auth.middleware');
const isAdmin = require('../middleware/admin.middleware');
const isSuperAdmin = require('../middleware/superadmin.middleware');

router.get('/:groupId/:startDate/:endDate',auth, isAdmin, reportController.getReport);

module.exports = router;