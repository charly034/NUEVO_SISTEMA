import { Router } from 'express';
import * as ctrl from './estadisticas.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAdmin);

router.get('/resumen',          ctrl.getResumen);
router.get('/platos-mas-usados', ctrl.getPlatosmasUsados);
router.get('/distribucion-tags', ctrl.getDistribucionTags);
router.get('/uso-por-dia',      ctrl.getUsoPorDia);
router.get('/tendencia-mensual', ctrl.getTendencia);
router.get('/top-por-dia',      ctrl.getTopPorDia);

export default router;
