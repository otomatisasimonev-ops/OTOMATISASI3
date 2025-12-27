import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import {checkRole} from '../middleware/checkRole.js';
import { adminListReports, getReportDetail, adminDeleteReportsBulk } from '../controllers/ujiAksesReportController.js';

const router = express.Router();

router.use(verifyToken, checkRole('admin'));
router.get('/', adminListReports);
router.post('/bulk-delete', adminDeleteReportsBulk);
router.get('/:id', getReportDetail);

export default router;

