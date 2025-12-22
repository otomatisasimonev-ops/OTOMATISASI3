import express from 'express';
import {assignToUser, listAssignments, listAssignmentsByUser, listMyAssignments} from '../controllers/assignmentController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { checkRole } from '../middleware/checkRole.js';

const router = express.Router();

// User can view assignments self
router.get('/me', verifyToken, listMyAssignments);

// Admin-only endpoints
router.use(verifyToken, checkRole('admin'));
router.get('/', listAssignments);
router.get('/:userId', listAssignmentsByUser);
router.post('/', assignToUser);

export default router;
