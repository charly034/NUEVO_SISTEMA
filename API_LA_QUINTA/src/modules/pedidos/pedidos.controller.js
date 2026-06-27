import * as service from './pedidos.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';

export const getMenuHoy = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getMenuHoy(), 'Menu del dia');
});

export const getMenuSemana = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getMenuSemana(req.query.fecha_inicio), 'Menu de la semana');
});

export const getMenuActivo = asyncHandler(async (req, res) => {
  const empresaId = req.empleado?.empresa_id ?? req.query.empresa_id ?? null;
  sendSuccess(res, await service.getMenuActivo(empresaId), 'Menu activo');
});

export const getSemanasPedido = asyncHandler(async (req, res) => {
  const empresaId = req.empleado?.empresa_id ?? req.query.empresaId ?? req.query.empresa_id ?? null;
  const empleadoId = req.empleado?.sub ?? req.query.usuarioId ?? req.query.usuario_id ?? null;
  sendSuccess(res, await service.getSemanasPedido({ empleadoId, empresaId }), 'Semanas de pedido');
});

export const getOpcionesMenuSemana = asyncHandler(async (req, res) => {
  const empresaId = req.empleado?.empresa_id ?? req.query.empresaId ?? req.query.empresa_id ?? null;
  sendSuccess(res, await service.getOpcionesMenuSemana({
    empresaId,
    semanaId: req.params.semanaId,
  }), 'Opciones de menu semanal');
});

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

export const getPedidos = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getPedidos(req.query), 'Pedidos obtenidos');
});

export const getPedidoById = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getPedidoById(req.params.id), 'Pedido obtenido');
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
