import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { createPlatoSchema, updatePlatoSchema, platoParamsSchema, platosQuerySchema } from './platos.schema.js';
import { getPlatos, getPlato, getTags, createPlato, updatePlato, deletePlato } from './platos.controller.js';
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

export default router;
