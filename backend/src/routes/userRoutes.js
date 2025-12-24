import express from 'express';
import { createUser, listUsers, getMe, deleteUser, deleteUsersBulk, resetUserPassword, updateRole, importUsers, updateMyPassword } from '../controllers/userController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { checkRole } from '../middleware/checkRole.js';

const router = express.Router();

router.use(verifyToken);

// User endpoints
router.get('/me', getMe);
router.patch('/me/password', updateMyPassword);

// Admin endpoints
router.get('/', checkRole('admin'), listUsers);
router.post('/', checkRole('admin'), createUser);
router.post('/import', checkRole('admin'), importUsers);
router.post('/bulk-delete', checkRole('admin'), deleteUsersBulk);
router.patch('/:id/password', checkRole('admin'), resetUserPassword);
router.patch('/:id/role', checkRole('admin'), updateRole);
router.delete('/:id', checkRole('admin'), deleteUser);

export default router;
