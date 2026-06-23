import * as service from './pedidos.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';

// Público: menú del día y de la semana
export const getMenuHoy = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getMenuHoy(), 'Menú del día');
});

export const getMenuSemana = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getMenuSemana(req.query.fecha_inicio), 'Menú de la semana');
});

// Público: menú publicado activo (sin necesidad de saber la fecha)
export const getMenuActivo = asyncHandler(async (req, res) => {
  // empresa_id puede venir del token (si está logueado) o como query param
  const empresaId = req.empleado?.empresa_id ?? req.query.empresa_id ?? null;
  sendSuccess(res, await service.getMenuActivo(empresaId), 'Menú activo');
});

// Requiere auth del empleado (req.empleado inyectado por middleware)
export const getMiPedido = asyncHandler(async (req, res) => {
  const pedido = await service.getMiPedido(req.empleado.sub, req.query.semana_inicio);
  sendSuccess(res, pedido, 'Pedido obtenido');
});

export const guardarPedido = asyncHandler(async (req, res) => {
  const pedido = await service.guardarPedido(
    req.empleado.sub,
    req.empleado.empresa_id,
    req.body,
    {
      actor_tipo: 'empleado',
      actor_id: req.empleado.sub,
      actor_nombre: `${req.empleado.nombre ?? ''} ${req.empleado.apellido ?? ''}`.trim(),
    }
  );
  sendCreated(res, pedido, 'Pedido guardado exitosamente');
});

// Admin: listar todos los pedidos
export const getPedidos = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getPedidos(req.query), 'Pedidos obtenidos');
});

export const updateEstado = asyncHandler(async (req, res) => {
  const adminNombre = `${req.adminUser?.nombre ?? ''} ${req.adminUser?.apellido ?? ''}`.trim();
  sendSuccess(res, await service.cambiarEstado(req.params.id, req.body.estado, {
    actor_tipo: 'admin',
    actor_id: req.adminUser?.sub,
    actor_nombre: adminNombre || req.adminUser?.email || req.adminUser?.rol || 'Admin',
  }), 'Estado actualizado');
});

export const getMiHistorial = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getMiHistorial(req.empleado.sub), 'Historial obtenido');
});

export const cancelarMiPedido = asyncHandler(async (req, res) => {
  const pedido = await service.cancelarMiPedido(req.empleado.sub, req.query.semana_inicio, {
    actor_tipo: 'empleado',
    actor_id: req.empleado.sub,
    actor_nombre: `${req.empleado.nombre ?? ''} ${req.empleado.apellido ?? ''}`.trim(),
  });
  sendSuccess(res, pedido, 'Pedido cancelado');
});
