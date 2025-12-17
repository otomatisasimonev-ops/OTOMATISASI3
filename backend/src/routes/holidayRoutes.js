import express from 'express';
import { listHolidays, createHoliday, deleteHoliday } from '../controllers/holidayController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { checkRole } from '../middleware/checkRole.js';

const router = express.Router();

router.get('/', verifyToken, listHolidays);
router.post('/', verifyToken, checkRole('admin'), createHoliday);
router.delete('/:id', verifyToken, checkRole('admin'), deleteHoliday);

export default router;
