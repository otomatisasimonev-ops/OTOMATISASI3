const express = require('express');
const {
  sendBulkEmail,
  getEmailLogs,
  streamEmailLogs,
  retryEmail
} = require('../controllers/emailController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/send', authMiddleware, sendBulkEmail);
router.get('/logs', authMiddleware, getEmailLogs);
router.get('/stream', authMiddleware, streamEmailLogs);
router.post('/retry/:id', authMiddleware, retryEmail);

module.exports = router;
