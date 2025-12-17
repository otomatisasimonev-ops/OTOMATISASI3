import express from 'express';
import { saveSmtpConfig, checkSmtpConfig, verifySmtpConfig, verifyImapConfig } from '../controllers/smtpController.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

router.post('/smtp', verifyToken, saveSmtpConfig);
router.post('/smtp/verify', verifyToken, verifySmtpConfig);
router.post('/imap/verify', verifyToken, verifyImapConfig);
router.get('/check', verifyToken, checkSmtpConfig);

export default router;