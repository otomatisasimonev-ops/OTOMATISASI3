const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { adminListReports, getReportDetail } = require('../controllers/ujiAksesReportController');

const router = express.Router();

router.use(authMiddleware, requireAdmin);

router.get('/', adminListReports);
router.get('/:id', getReportDetail);

module.exports = router;

