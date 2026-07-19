import { Router } from 'express';
import { getMenuColores, updateMenuColores } from './configuracion.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();

// Lectura protegida por admin (la página resumen es admin). Escritura idem.
router.get('/menu-colores', requireAdmin, getMenuColores);
router.put('/menu-colores', requireAdmin, updateMenuColores);

export default router;
