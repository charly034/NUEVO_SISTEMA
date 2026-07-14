import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';
import {
  idParamsSchema,
  reasignarCategoriaSchema,
  agregarItemSchema,
  empresaIdParamsSchema,
  excepcionEmpresaSchema,
} from './menu-items.schema.js';
import {
  postMenuItem,
  patchMenuItem,
  deleteMenuItem,
  getExcepcionesEmpresa,
  putExcepcionEmpresa,
  deleteExcepcionEmpresa,
} from './menu-items.controller.js';

const router = Router();
router.use(requireAdmin);

router.post('/', validate({ body: agregarItemSchema }), postMenuItem);

// Excepciones de guarnición/salsa por empresa sobre una celda (T8). Se cuelgan de
// la celda (:id = menu_semanal_dias.id): el backend deriva de ahí el ancla por
// claves de negocio y la guarda plato_id_origen.
router.get('/:id/excepciones-empresa', validate({ params: idParamsSchema }), getExcepcionesEmpresa);
router.put(
  '/:id/excepciones-empresa/:empresaId',
  validate({ params: empresaIdParamsSchema, body: excepcionEmpresaSchema }),
  putExcepcionEmpresa
);
router.delete(
  '/:id/excepciones-empresa/:empresaId',
  validate({ params: empresaIdParamsSchema }),
  deleteExcepcionEmpresa
);

router.patch('/:id', validate({ params: idParamsSchema, body: reasignarCategoriaSchema }), patchMenuItem);
router.delete('/:id', validate({ params: idParamsSchema }), deleteMenuItem);

export default router;
