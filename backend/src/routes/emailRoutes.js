import express from 'express';
import {
  sendBulkEmail,
  getEmailLogs,
  streamEmailLogs,
  retryEmail
} from '../controllers/emailController.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

router.post('/send', verifyToken, sendBulkEmail);
router.get('/logs', verifyToken, getEmailLogs);
router.get('/stream', verifyToken, streamEmailLogs);
router.post('/retry/:id', verifyToken, retryEmail);

export default router;
