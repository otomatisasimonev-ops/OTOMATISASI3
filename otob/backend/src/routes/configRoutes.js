const express = require('express');
const { saveSmtpConfig, checkSmtpConfig, verifySmtpConfig } = require('../controllers/smtpController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/smtp', authMiddleware, saveSmtpConfig);
router.post('/smtp/verify', authMiddleware, verifySmtpConfig);
router.get('/check', authMiddleware, checkSmtpConfig);

module.exports = router;
