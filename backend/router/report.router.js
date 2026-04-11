const express = require("express");
const router = express.Router();
const reportController = require('../controller/report.controller');
const {verifyToken, loadGroup} = require('../middleware/auth.middleware');

router.get('/:groupId/:startDate/:endDate',verifyToken, loadGroup, reportController.getReport);

module.exports = router;