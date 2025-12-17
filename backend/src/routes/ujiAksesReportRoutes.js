import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { QUESTIONS } from '../utils/ujiAksesRubric.js';
import {
  createReport,
  updateDraftReport,
  listMyReports,
  getReportDetail,
  submitReport,
  uploadEvidence,
  ensureReportUploadDir
} from '../controllers/ujiAksesReportController.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', createReport);
router.get('/me', listMyReports);
router.get('/:id', getReportDetail);
router.patch('/:id', updateDraftReport);
router.patch('/:id/submit', submitReport);

const allowedMime = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const reportId = req.params.id;
    const questionKey = String(req.body?.questionKey || req.query?.questionKey || '').trim();
    if (!QUESTIONS.some((q) => q.key === questionKey)) {
      return cb(new Error('questionKey tidak valid'));
    }
    const dir = ensureReportUploadDir(reportId, questionKey);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const id = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}_${id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) {
      return cb(new Error('Tipe file tidak didukung (hanya gambar/pdf)'));
    }
    cb(null, true);
  }
});

router.post('/:id/upload', upload.array('files', 10), uploadEvidence);

router.use((err, req, res, next) => {
  if (!err) return next();
  return res.status(400).json({ message: err.message || 'Upload gagal' });
});

export default router;
