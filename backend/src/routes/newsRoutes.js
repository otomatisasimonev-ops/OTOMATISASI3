import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { listKipNews } from '../controllers/newsController.js';

const router = express.Router();

router.get('/kip', verifyToken, listKipNews);

export default router;
