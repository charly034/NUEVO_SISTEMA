import * as repo from './guarniciones.repository.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

export const getGuarniciones = asyncHandler(async (req, res) => {
  const soloActivas = req.query.activo === 'true';
  sendSuccess(res, await repo.findAll(soloActivas), 'Guarniciones obtenidas');
});

const TIPOS_VALIDOS = ['caliente', 'fria'];

export const createGuarnicion = asyncHandler(async (req, res) => {
  const { nombre, tipo } = req.body;
  if (!nombre?.trim()) throw ApiError.badRequest('El nombre es requerido');
  if (tipo && !TIPOS_VALIDOS.includes(tipo)) throw ApiError.badRequest('Tipo inválido');
  sendCreated(res, await repo.create(nombre.trim(), tipo ?? null), 'Guarnición creada');
});

export const updateGuarnicion = asyncHandler(async (req, res) => {
  const g = await repo.findById(req.params.id);
  if (!g) throw ApiError.notFound('Guarnición no encontrada');
  const fields = {};
  if (typeof req.body.nombre === 'string' && req.body.nombre.trim()) fields.nombre = req.body.nombre.trim();
  if (typeof req.body.activo === 'boolean') fields.activo = req.body.activo;
  if (req.body.tipo !== undefined) {
    if (req.body.tipo !== null && !TIPOS_VALIDOS.includes(req.body.tipo)) throw ApiError.badRequest('Tipo inválido');
    fields.tipo = req.body.tipo;
  }
  if (Object.keys(fields).length === 0) throw ApiError.badRequest('No hay campos válidos para actualizar');
  sendSuccess(res, await repo.update(req.params.id, fields), 'Guarnición actualizada');
});

export const deleteGuarnicion = asyncHandler(async (req, res) => {
  const g = await repo.findById(req.params.id);
  if (!g) throw ApiError.notFound('Guarnición no encontrada');
  await repo.remove(req.params.id);
  sendNoContent(res);
});
