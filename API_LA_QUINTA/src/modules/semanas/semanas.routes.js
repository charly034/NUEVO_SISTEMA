import { Router } from 'express';
import { getSemanas, getSemanaActual, getSemana } from './semanas.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
// `/actual` antes de `/:id` para que no lo capture como id.
router.get('/', requireAdmin, getSemanas);
router.get('/actual', requireAdmin, getSemanaActual);
router.get('/:id', requireAdmin, getSemana);
export default router;
