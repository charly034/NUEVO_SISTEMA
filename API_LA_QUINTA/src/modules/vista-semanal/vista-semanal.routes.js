import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { vistaSemanalParamsSchema } from './vista-semanal.schema.js';
import { getVistaSemanal } from './vista-semanal.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAdmin);

router.get('/:menuSemanalId', validate({ params: vistaSemanalParamsSchema }), getVistaSemanal);

export default router;
