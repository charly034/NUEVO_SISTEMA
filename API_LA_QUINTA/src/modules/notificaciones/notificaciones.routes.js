import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import * as ctrl from './notificaciones.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/',                   ctrl.listar);
router.get('/no-leidas/count',    ctrl.contarNoLeidas);
router.patch('/leer-todas',       ctrl.marcarTodasLeidas);
router.patch('/:id/leer',         ctrl.marcarLeida);

export default router;
