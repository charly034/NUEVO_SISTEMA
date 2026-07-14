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

// ── Excepciones de guarnición/salsa por empresa sobre una celda (T8) ──────────

export const getExcepcionesEmpresa = asyncHandler(async (req, res) => {
  const excepciones = await service.listarExcepciones(Number(req.params.id));
  sendSuccess(res, excepciones);
});

export const putExcepcionEmpresa = asyncHandler(async (req, res) => {
  const excepciones = await service.guardarExcepcion(
    Number(req.params.id),
    Number(req.params.empresaId),
    req.body
  );
  sendSuccess(res, excepciones, 'Excepción por empresa guardada');
});

export const deleteExcepcionEmpresa = asyncHandler(async (req, res) => {
  const excepciones = await service.borrarExcepcion(
    Number(req.params.id),
    Number(req.params.empresaId)
  );
  sendSuccess(res, excepciones, 'Excepción por empresa eliminada');
});
