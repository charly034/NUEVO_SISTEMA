import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';
import { idParamsSchema, reasignarCategoriaSchema, agregarItemSchema } from './menu-items.schema.js';
import { postMenuItem, patchMenuItem, deleteMenuItem } from './menu-items.controller.js';

const router = Router();
router.use(requireAdmin);

router.post('/', validate({ body: agregarItemSchema }), postMenuItem);
router.patch('/:id', validate({ params: idParamsSchema, body: reasignarCategoriaSchema }), patchMenuItem);
router.delete('/:id', validate({ params: idParamsSchema }), deleteMenuItem);

export default router;
