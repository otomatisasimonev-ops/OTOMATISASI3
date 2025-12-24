import express from 'express';
import {
  getMeQuota,
  setUserQuota,
  createQuotaRequest,
  listQuotaRequests,
  updateQuotaRequest,
  listMyQuotaRequests
} from '../controllers/quotaController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { checkRole } from '../middleware/checkRole.js';

const router = express.Router();

router.use(verifyToken);

// User endpoints
router.get('/me', getMeQuota);
router.get('/my-requests', listMyQuotaRequests);
router.post('/request', createQuotaRequest);

// Admin endpoints
router.get('/requests', checkRole('admin'), listQuotaRequests);
router.patch('/requests/:id', checkRole('admin'), updateQuotaRequest);
router.patch('/user/:userId', checkRole('admin'), setUserQuota);

export default router;
