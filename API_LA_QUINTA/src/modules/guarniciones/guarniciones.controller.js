import * as repo from './guarniciones.repository.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import * as auditoriaService from '../admin-auditoria/admin-auditoria.service.js';

export const getGuarniciones = asyncHandler(async (req, res) => {
  const soloActivas = req.query.activo === 'true';
  sendSuccess(res, await repo.findAll(soloActivas), 'Guarniciones obtenidas');
});

const TIPOS_VALIDOS = ['caliente', 'fria'];

export const createGuarnicion = asyncHandler(async (req, res) => {
  const { nombre, tipo } = req.body;
  if (!nombre?.trim()) throw ApiError.badRequest('El nombre es requerido');
  if (tipo && !TIPOS_VALIDOS.includes(tipo)) throw ApiError.badRequest('Tipo inválido');
  const creada = await repo.create(nombre.trim(), tipo ?? null);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'crear',
    entidad_tipo: 'guarnicion',
    entidad_id: creada.id,
    resumen: `Creó la guarnición ${creada.nombre}`,
    despues: creada,
  });
  sendCreated(res, creada, 'Guarnición creada');
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
  const actualizada = await repo.update(req.params.id, fields);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'actualizar',
    entidad_tipo: 'guarnicion',
    entidad_id: req.params.id,
    resumen: `Actualizó la guarnición ${actualizada.nombre}`,
    antes: g,
    despues: actualizada,
  });
  sendSuccess(res, actualizada, 'Guarnición actualizada');
});

export const deleteGuarnicion = asyncHandler(async (req, res) => {
  const g = await repo.findById(req.params.id);
  if (!g) throw ApiError.notFound('Guarnición no encontrada');
  await repo.remove(req.params.id);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'eliminar',
    entidad_tipo: 'guarnicion',
    entidad_id: req.params.id,
    resumen: `Eliminó la guarnición ${g.nombre}`,
    antes: g,
  });
  sendNoContent(res);
});
