import express from 'express';
import {
  listBadanPublik,
  getBadanPublik,
  createBadanPublik,
  updateBadanPublik,
  deleteBadanPublik,
  deleteBadanPublikBulk,
  importBadanPublik,
  importBadanPublikWithAssignment
} from '../controllers/badanPublikController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { checkRole } from '../middleware/checkRole.js';

const router = express.Router();

router.use(verifyToken);

// Public endpoints (all authenticated users)
router.get('/', listBadanPublik);
router.get('/:id', getBadanPublik);
router.put('/:id', updateBadanPublik);

// Admin endpoints
router.post('/', checkRole('admin'), createBadanPublik);
router.post('/import', checkRole('admin'), importBadanPublik);
router.post('/import-assign', checkRole('admin'), importBadanPublikWithAssignment);
router.post('/bulk-delete', checkRole('admin'), deleteBadanPublikBulk);
router.delete('/:id', checkRole('admin'), deleteBadanPublik);

export default router;
