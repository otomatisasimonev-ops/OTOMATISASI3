import express from 'express';
import { saveSmtpConfig, checkSmtpConfig, verifySmtpConfig, verifyImapConfig } from '../controllers/smtpController.js';
import { resetDatabase } from '../controllers/resetController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { checkRole } from '../middleware/checkRole.js';

const router = express.Router();

router.use(verifyToken);

router.get('/check', checkSmtpConfig);
router.post('/smtp', saveSmtpConfig);
router.post('/smtp/verify', verifySmtpConfig);
router.post('/imap/verify', verifyImapConfig);
router.post('/reset', checkRole('admin'), resetDatabase);

export default router;
