import * as service from './menu-items.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';

export const postMenuItem = asyncHandler(async (req, res) => {
  const item = await service.agregar(req.body);
  sendCreated(res, item, 'Plato agregado a la categoría');
});

export const patchMenuItem = asyncHandler(async (req, res) => {
  const item = await service.reasignarCategoria(Number(req.params.id), req.body.categoria_id);
  sendSuccess(res, item, 'Item de menú reasignado');
});

export const deleteMenuItem = asyncHandler(async (req, res) => {
  await service.eliminar(Number(req.params.id));
  sendSuccess(res, { ok: true }, 'Item de menú eliminado');
});
