import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { checkRole } from '../middleware/checkRole.js';
import {
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  deleteAllQuestions,
  resetQuestions
} from '../controllers/ujiAksesQuestionController.js';

const router = express.Router();

router.use(verifyToken);

// Public endpoints (all authenticated users)
router.get('/', listQuestions);

// Admin endpoints
router.post('/', checkRole('admin'), createQuestion);
router.post('/reset', checkRole('admin'), resetQuestions);
router.put('/:id', checkRole('admin'), updateQuestion);
router.delete('/all', checkRole('admin'), deleteAllQuestions);
router.delete('/:id', checkRole('admin'), deleteQuestion);

export default router;
