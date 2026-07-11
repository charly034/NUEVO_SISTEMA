import * as repo from './salsas.repository.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

export const getSalsas = asyncHandler(async (req, res) => {
  const soloActivas = req.query.activo === 'true';
  sendSuccess(res, await repo.findAll(soloActivas), 'Salsas obtenidas');
});

export const createSalsa = asyncHandler(async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) throw ApiError.badRequest('El nombre es requerido');
  sendCreated(res, await repo.create(nombre.trim()), 'Salsa creada');
});

export const updateSalsa = asyncHandler(async (req, res) => {
  const s = await repo.findById(req.params.id);
  if (!s) throw ApiError.notFound('Salsa no encontrada');
  const fields = {};
  if (typeof req.body.nombre === 'string' && req.body.nombre.trim()) fields.nombre = req.body.nombre.trim();
  if (typeof req.body.activo === 'boolean') fields.activo = req.body.activo;
  if (Object.keys(fields).length === 0) throw ApiError.badRequest('No hay campos válidos para actualizar');
  sendSuccess(res, await repo.update(req.params.id, fields), 'Salsa actualizada');
});

export const deleteSalsa = asyncHandler(async (req, res) => {
  const s = await repo.findById(req.params.id);
  if (!s) throw ApiError.notFound('Salsa no encontrada');
  await repo.remove(req.params.id);
  sendNoContent(res);
});
