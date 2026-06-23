import { Router } from 'express';
import { getSugerencias } from './sugerencias.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAdmin);
router.get('/semana', getSugerencias);
export default router;
