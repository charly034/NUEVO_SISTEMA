import * as repo from './guarniciones.repository.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

export const getGuarniciones = asyncHandler(async (req, res) => {
  const soloActivas = req.query.activo === 'true';
  sendSuccess(res, await repo.findAll(soloActivas), 'Guarniciones obtenidas');
});

export const createGuarnicion = asyncHandler(async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) throw ApiError.badRequest('El nombre es requerido');
  sendCreated(res, await repo.create(nombre.trim()), 'Guarnición creada');
});

export const updateGuarnicion = asyncHandler(async (req, res) => {
  const g = await repo.findById(req.params.id);
  if (!g) throw ApiError.notFound('Guarnición no encontrada');
  const fields = {};
  if (typeof req.body.nombre === 'string' && req.body.nombre.trim()) fields.nombre = req.body.nombre.trim();
  if (typeof req.body.activo === 'boolean') fields.activo = req.body.activo;
  if (Object.keys(fields).length === 0) throw ApiError.badRequest('No hay campos válidos para actualizar');
  sendSuccess(res, await repo.update(req.params.id, fields), 'Guarnición actualizada');
});

export const deleteGuarnicion = asyncHandler(async (req, res) => {
  const g = await repo.findById(req.params.id);
  if (!g) throw ApiError.notFound('Guarnición no encontrada');
  await repo.remove(req.params.id);
  sendNoContent(res);
});
