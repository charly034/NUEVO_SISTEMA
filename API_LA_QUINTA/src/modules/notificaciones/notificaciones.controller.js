import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import * as repo from './notificaciones.repository.js';

export const listar = asyncHandler(async (req, res) => {
  const notifs = await repo.findByEmpleado(req.empleado.id);
  res.json({ data: notifs });
});

export const contarNoLeidas = asyncHandler(async (req, res) => {
  const count = await repo.countNoLeidas(req.empleado.id);
  res.json({ data: { count } });
});

export const marcarLeida = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw new ApiError(400, 'ID inválido');
  const notif = await repo.marcarLeida(id, req.empleado.id);
  if (!notif) throw new ApiError(404, 'Notificación no encontrada');
  res.json({ data: { id } });
});

export const marcarTodasLeidas = asyncHandler(async (req, res) => {
  const actualizadas = await repo.marcarTodasLeidas(req.empleado.id);
  res.json({ data: { actualizadas } });
});
