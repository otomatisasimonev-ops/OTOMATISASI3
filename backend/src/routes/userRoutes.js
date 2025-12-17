import express from 'express';
import { createUser, listUsers, getMe, deleteUser, resetPassword, updateRole } from '../controllers/userController.js';
import {verifyToken} from '../middleware/verifyToken.js';
import {checkRole} from '../middleware/checkRole.js';

const router = express.Router();

router.get('/me', verifyToken, getMe);

router.use(verifyToken, checkRole('admin'));
router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id/password', resetPassword);
router.patch('/:id/role', updateRole);
router.delete('/:id', deleteUser);

export default router;
