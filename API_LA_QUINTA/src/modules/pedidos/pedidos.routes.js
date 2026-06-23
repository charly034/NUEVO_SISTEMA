import { Router } from 'express';
import { requireAuth, optionalAuth, requireAdmin } from '../../middlewares/auth.middleware.js';
import {
  getMenuHoy, getMenuSemana, getMenuActivo,
  getMiPedido, guardarPedido, cancelarMiPedido, getMiHistorial,
  getPedidos, updateEstado,
} from './pedidos.controller.js';

const router = Router();

// Públicos (solo lectura del menú)
router.get('/menu-hoy', getMenuHoy);
router.get('/menu-semana', getMenuSemana);
router.get('/menu-activo', optionalAuth, getMenuActivo);

// Requieren login del empleado
router.get('/mi-pedido', requireAuth, getMiPedido);
router.post('/', requireAuth, guardarPedido);
router.delete('/mi-pedido', requireAuth, cancelarMiPedido);
router.get('/mi-historial', requireAuth, getMiHistorial);

// Admin
router.get('/', requireAdmin, getPedidos);
router.patch('/:id/estado', requireAdmin, updateEstado);

export default router;
