const express = require('express');
const { listHolidays, createHoliday, deleteHoliday } = require('../controllers/holidayController');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, listHolidays);
router.post('/', authMiddleware, requireAdmin, createHoliday);
router.delete('/:id', authMiddleware, requireAdmin, deleteHoliday);

module.exports = router;
