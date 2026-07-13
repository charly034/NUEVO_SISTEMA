import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { createViandaSchema, updateViandaSchema, viandaParamsSchema, viandasQuerySchema } from './viandas.schema.js';
import { getViandas, getVianda, createVianda, updateVianda } from './viandas.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAdmin);

router.get('/', validate({ query: viandasQuerySchema }), getViandas);
router.get('/:id', validate({ params: viandaParamsSchema }), getVianda);
router.post('/', validate({ body: createViandaSchema }), createVianda);
router.put('/:id', validate({ params: viandaParamsSchema, body: updateViandaSchema }), updateVianda);

export default router;
