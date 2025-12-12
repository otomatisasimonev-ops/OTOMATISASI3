const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { listKipNews } = require('../controllers/newsController');

const router = express.Router();

router.get('/kip', authMiddleware, listKipNews);

module.exports = router;

