import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { verifyToken } from '../middleware/verifyToken.js';
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

// Constants
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg'
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const reportId = req.params.id;
    const questionKey = String(req.body?.questionKey || req.query?.questionKey || '').trim();
    
    if (!questionKey) {
      return cb(new Error('questionKey tidak valid'));
    }
    
    const safeKey = questionKey.replace(/[^\w-]/g, '');
    const dir = ensureReportUploadDir(reportId, safeKey);
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
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Tipe file tidak didukung (hanya gambar/pdf)'));
    }
    cb(null, true);
  }
});

// Apply authentication to all routes
router.use(verifyToken);

// Report endpoints
router.get('/me', listMyReports);
router.get('/:id', getReportDetail);
router.post('/', createReport);
router.patch('/:id', updateDraftReport);
router.patch('/:id/submit', submitReport);
router.post('/:id/upload', upload.array('files', MAX_FILES), uploadEvidence);

// Error handler for multer
router.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ message: err.message || 'Upload gagal' });
  }
  next();
});

export default router;
