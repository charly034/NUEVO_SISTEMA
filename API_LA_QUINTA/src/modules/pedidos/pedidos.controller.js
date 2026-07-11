import * as service from './pedidos.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { cambiarEstadoItemSchema } from './pedidos.validation.js';

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

export const guardarSugerenciaPedido = asyncHandler(async (req, res) => {
  const sugerencia = await service.guardarSugerenciaPedido(
    req.empleado.sub,
    req.empleado.empresa_id,
    req.body,
  );
  sendCreated(res, sugerencia, 'Sugerencia guardada exitosamente');
});

export const actualizarPedido = asyncHandler(async (req, res) => {
  const pedido = await service.actualizarPedidoEmpleado(
    req.empleado.sub,
    req.empleado.empresa_id,
    req.params.id,
    req.body,
    {
      actor_tipo: 'empleado',
      actor_id: req.empleado.sub,
      actor_nombre: `${req.empleado.nombre ?? ''} ${req.empleado.apellido ?? ''}`.trim(),
    }
  );
  sendSuccess(res, pedido, 'Pedido actualizado exitosamente');
});

export const confirmarPedido = asyncHandler(async (req, res) => {
  const pedido = await service.confirmarPedidoEmpleado(
    req.empleado.sub,
    req.empleado.empresa_id,
    req.params.id,
    {
      actor_tipo: 'empleado',
      actor_id: req.empleado.sub,
      actor_nombre: `${req.empleado.nombre ?? ''} ${req.empleado.apellido ?? ''}`.trim(),
    }
  );
  sendSuccess(res, pedido, 'Pedido confirmado exitosamente');
});

export const getPedidos = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getPedidos(req.query), 'Pedidos obtenidos');
});

export const getSugerenciasPedidoAdmin = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getSugerenciasPedidoAdmin(req.query), 'Sugerencias obtenidas');
});

export const getResumenSugerenciasAdmin = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getResumenSugerencias(req.query), 'Resumen de sugerencias obtenido');
});

export const getOpcionesSugerencia = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getOpcionesSugerencia(req.query), 'Opciones de sugerencia obtenidas');
});

export const reemplazarOpcionesSugerencia = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.reemplazarOpcionesSugerencia(req.body), 'Opciones de sugerencia actualizadas');
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
    adminUser: req.adminUser,
  }), 'Estado actualizado');
});

export const updateEstadoItem = asyncHandler(async (req, res) => {
  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) throw ApiError.badRequest('itemId invalido');
  const parsed = cambiarEstadoItemSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Estado inválido');
  const { estado } = parsed.data;
  const adminNombre = `${req.adminUser?.nombre ?? ''} ${req.adminUser?.apellido ?? ''}`.trim();
  sendSuccess(res, await service.cambiarEstadoItem(itemId, estado, {
    actor_tipo: 'admin',
    actor_id: req.adminUser?.sub,
    actor_nombre: adminNombre || req.adminUser?.email || req.adminUser?.rol || 'Admin',
    adminUser: req.adminUser,
  }), 'Estado de vianda actualizado');
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

export const cancelarDiaMiPedido = asyncHandler(async (req, res) => {
  const pedido = await service.cancelarDiaMiPedido(
    req.empleado.sub,
    req.empleado.empresa_id,
    req.params.id,
    req.params.dia,
    {
      actor_tipo: 'empleado',
      actor_id: req.empleado.sub,
      actor_nombre: `${req.empleado.nombre ?? ''} ${req.empleado.apellido ?? ''}`.trim(),
    },
  );
  sendSuccess(res, pedido, 'Dia cancelado');
});
