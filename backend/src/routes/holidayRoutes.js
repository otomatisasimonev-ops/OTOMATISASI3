import express from 'express';
import {
  listHolidays,
  createHoliday,
  deleteHoliday
} from '../controllers/holidayController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { checkRole } from '../middleware/checkRole.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', listHolidays);
router.post('/', checkRole('admin'), createHoliday);
router.delete('/:id', checkRole('admin'), deleteHoliday);

export default router;
