import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import * as ctrl from './sugerencias-empleados.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/',  ctrl.obtener);
router.post('/', ctrl.crear);

export default router;
