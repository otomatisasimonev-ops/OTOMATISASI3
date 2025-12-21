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
router.get('/', listBadanPublik);
router.get('/:id', getBadanPublik);
router.post('/', checkRole('admin'), createBadanPublik);
router.put('/:id', updateBadanPublik);
router.post('/bulk-delete', checkRole('admin'), deleteBadanPublikBulk);
router.delete('/:id', checkRole('admin'), deleteBadanPublik);
router.post('/import', checkRole('admin'), importBadanPublik);
router.post('/import-assign', checkRole('admin'), importBadanPublikWithAssignment);

export default router;
