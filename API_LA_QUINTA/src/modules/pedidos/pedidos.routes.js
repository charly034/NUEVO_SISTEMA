import { Router } from 'express';
import { requireAuth, optionalAuth, requireAdmin } from '../../middlewares/auth.middleware.js';
import {
  getMenuHoy, getMenuSemana, getMenuActivo,
  getOpcionesMenuSemana,
  getSemanasPedido,
  getMiPedido, guardarPedido, actualizarPedido, confirmarPedido, cancelarMiPedido, getMiHistorial,
  getPedidos, getPedidoById, updateEstado,
} from './pedidos.controller.js';

const router = Router();

// Públicos (solo lectura del menú)
router.get('/menu-hoy', getMenuHoy);
router.get('/menu-semana', getMenuSemana);
router.get('/menu-activo', optionalAuth, getMenuActivo);
router.get('/menu/semanas/:semanaId/opciones', optionalAuth, getOpcionesMenuSemana);

// Requieren login del empleado
router.get('/semanas', requireAuth, getSemanasPedido);
router.get('/mi-pedido', requireAuth, getMiPedido);
router.post('/', requireAuth, guardarPedido);
router.put('/:id', requireAuth, actualizarPedido);
router.patch('/:id/confirmar', requireAuth, confirmarPedido);
router.delete('/mi-pedido', requireAuth, cancelarMiPedido);
router.get('/mi-historial', requireAuth, getMiHistorial);

// Admin
router.get('/', requireAdmin, getPedidos);
router.get('/:id', requireAdmin, getPedidoById);
router.patch('/:id/estado', requireAdmin, updateEstado);

export default router;
