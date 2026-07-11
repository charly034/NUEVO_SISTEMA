import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { createPlatoSchema, updatePlatoSchema, platoParamsSchema, platosQuerySchema, setDisponibilidadLocalSchema } from './platos.schema.js';
import { getPlatos, getPlato, getTags, createPlato, updatePlato, deletePlato, getVisibilidadEmpresas, setVisibilidadEmpresas, getDisponibilidadLocal, setDisponibilidadLocal } from './platos.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';
import { uploadPlatoImage } from '../../middlewares/upload-plato-image.middleware.js';

const router = Router();
router.use(requireAdmin);

router.get('/tags', getTags);
router.get('/', validate({ query: platosQuerySchema }), getPlatos);
router.get('/:id', validate({ params: platoParamsSchema }), getPlato);
router.post('/', uploadPlatoImage, validate({ body: createPlatoSchema }), createPlato);
router.put('/:id', uploadPlatoImage, validate({ params: platoParamsSchema, body: updatePlatoSchema }), updatePlato);
router.delete('/:id', validate({ params: platoParamsSchema }), deletePlato);

router.get('/:id/visibilidad-empresas', validate({ params: platoParamsSchema }), getVisibilidadEmpresas);
router.put('/:id/visibilidad-empresas', validate({ params: platoParamsSchema }), setVisibilidadEmpresas);

router.get('/:id/disponibilidad-local', validate({ params: platoParamsSchema }), getDisponibilidadLocal);
router.put('/:id/disponibilidad-local', validate({ params: platoParamsSchema, body: setDisponibilidadLocalSchema }), setDisponibilidadLocal);

export default router;
