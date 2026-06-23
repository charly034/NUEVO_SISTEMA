import { Router } from 'express';
import { getGuarniciones, createGuarnicion, updateGuarnicion, deleteGuarnicion } from './guarniciones.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.get('/', getGuarniciones);
router.post('/', requireAdmin, createGuarnicion);
router.patch('/:id', requireAdmin, updateGuarnicion);
router.delete('/:id', requireAdmin, deleteGuarnicion);
export default router;
