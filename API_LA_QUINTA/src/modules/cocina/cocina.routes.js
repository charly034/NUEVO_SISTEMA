import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';
import { getCocinaHoy, getCocinaSemana, getEtiquetas, getOfertaSemanal } from './cocina.controller.js';
import { menuIdParamsSchema, etiquetasParamsSchema, hoyQuerySchema } from './cocina.validation.js';

const router = Router();
router.use(requireAdmin);

router.get('/hoy',                    validate({ query: hoyQuerySchema }),        getCocinaHoy);
router.get('/semana/:menuId',         validate({ params: menuIdParamsSchema }),    getCocinaSemana);
router.get('/oferta/:menuId',         validate({ params: menuIdParamsSchema }),    getOfertaSemanal);
router.get('/etiquetas/:menuId/:dia', validate({ params: etiquetasParamsSchema }), getEtiquetas);

export default router;
