const express = require("express");
const router = express.Router();
const reportController = require('../Controller/report.controller');
const {verifyToken, loadGroup} = require('../Middleware/auth.middleware');

router.get('/:groupId/:startDate/:endDate',verifyToken, loadGroup, reportController.getReport);

module.exports = router;