import express from 'express';
import {
  sendBulkEmail,
  getEmailLogs,
  streamEmailLogs,
  retryEmail
} from '../controllers/emailController.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

router.use(verifyToken);

router.get('/logs', getEmailLogs);
router.get('/stream', streamEmailLogs);
router.post('/send', sendBulkEmail);
router.post('/retry/:id', retryEmail);

export default router;
