const express = require('express');
const { saveSmtpConfig, checkSmtpConfig } = require('../controllers/smtpController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/smtp', authMiddleware, saveSmtpConfig);
router.get('/check', authMiddleware, checkSmtpConfig);

module.exports = router;
