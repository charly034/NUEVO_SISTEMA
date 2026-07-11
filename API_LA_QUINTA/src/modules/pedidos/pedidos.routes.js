import { Router } from 'express';
import { requireAuth, optionalAuth, requireAdmin } from '../../middlewares/auth.middleware.js';
import {
  getMenuHoy, getMenuSemana, getMenuActivo,
  getSemanasPedido,
  getMiPedido, guardarPedido, guardarSugerenciaPedido, actualizarPedido, confirmarPedido, cancelarMiPedido, cancelarDiaMiPedido, getMiHistorial,
  getPedidos, getSugerenciasPedidoAdmin, getResumenSugerenciasAdmin, getOpcionesSugerencia, reemplazarOpcionesSugerencia, getPedidoById, updateEstado, updateEstadoItem,
} from './pedidos.controller.js';

const router = Router();

// Públicos (solo lectura del menú)
router.get('/menu-hoy', getMenuHoy);
router.get('/menu-semana', getMenuSemana);
router.get('/menu-activo', optionalAuth, getMenuActivo);

// Requieren login del empleado
router.get('/semanas', requireAuth, getSemanasPedido);
router.get('/mi-pedido', requireAuth, getMiPedido);
router.get('/sugerencias/opciones', optionalAuth, getOpcionesSugerencia);
router.post('/sugerencias', requireAuth, guardarSugerenciaPedido);
router.post('/', requireAuth, guardarPedido);
router.put('/:id', requireAuth, actualizarPedido);
router.patch('/:id/confirmar', requireAuth, confirmarPedido);
router.delete('/:id/dias/:dia', requireAuth, cancelarDiaMiPedido);
router.delete('/mi-pedido', requireAuth, cancelarMiPedido);
router.get('/mi-historial', requireAuth, getMiHistorial);

// Admin
router.get('/', requireAdmin, getPedidos);
router.put('/sugerencias/opciones', requireAdmin, reemplazarOpcionesSugerencia);
router.get('/sugerencias/resumen', requireAdmin, getResumenSugerenciasAdmin);
router.get('/sugerencias', requireAdmin, getSugerenciasPedidoAdmin);
router.patch('/items/:itemId/estado', requireAdmin, updateEstadoItem);
router.get('/:id', requireAdmin, getPedidoById);
router.patch('/:id/estado', requireAdmin, updateEstado);

export default router;
