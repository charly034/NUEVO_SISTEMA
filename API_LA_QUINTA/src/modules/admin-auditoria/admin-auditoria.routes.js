import { Router } from 'express';
import { requireAdmin } from '../../middlewares/auth.middleware.js';
import { getAuditoria } from './admin-auditoria.controller.js';

const router = Router();
router.use(requireAdmin);
router.get('/', getAuditoria);

export default router;
