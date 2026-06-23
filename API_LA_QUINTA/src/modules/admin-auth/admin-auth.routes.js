import { Router } from 'express';
import { requireAdminAuth, requireSuperAdmin } from '../../middlewares/auth.middleware.js';
import {
  loginController, meController,
  listController, createController, updateController, deleteController,
} from './admin-auth.controller.js';

const router = Router();

// Públicas
router.post('/login', loginController);

// Requieren token admin
router.get('/me', requireAdminAuth, meController);

// Gestión de usuarios (solo superadmin)
router.get('/usuarios',        requireAdminAuth, requireSuperAdmin, listController);
router.post('/usuarios',       requireAdminAuth, requireSuperAdmin, createController);
router.patch('/usuarios/:id',  requireAdminAuth, requireSuperAdmin, updateController);
router.delete('/usuarios/:id', requireAdminAuth, requireSuperAdmin, deleteController);

export default router;
