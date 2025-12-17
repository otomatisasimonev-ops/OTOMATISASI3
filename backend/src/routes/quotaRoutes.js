import express from 'express';
import { getMeQuota,
  setUserQuota,
  createQuotaRequest,
  listQuotaRequests,
  updateQuotaRequest,
  listMyQuotaRequests } from '../controllers/quotaController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { checkRole } from '../middleware/checkRole.js';

const router = express.Router();

router.use(verifyToken);
router.get('/me', getMeQuota);
router.post('/request', createQuotaRequest);
router.get('/my-requests', listMyQuotaRequests);

router.use(checkRole('admin'));
router.get('/requests', listQuotaRequests);
router.patch('/requests/:id', updateQuotaRequest);
router.patch('/user/:userId', setUserQuota);

export default router;
