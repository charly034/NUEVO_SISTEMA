import { Router } from 'express';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { getOpcionesMenuSemana } from '../pedidos/pedidos.controller.js';

const router = Router();

router.get('/semanas/:semanaId/opciones', optionalAuth, getOpcionesMenuSemana);

export default router;
