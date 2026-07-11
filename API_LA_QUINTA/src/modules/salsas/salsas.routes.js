import { Router } from 'express';
import { getSalsas, createSalsa, updateSalsa, deleteSalsa } from './salsas.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.get('/', getSalsas);
router.post('/', requireAdmin, createSalsa);
router.patch('/:id', requireAdmin, updateSalsa);
router.delete('/:id', requireAdmin, deleteSalsa);
export default router;
