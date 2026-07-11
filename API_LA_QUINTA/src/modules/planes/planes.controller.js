import * as repo from './planes.repository.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

function slugPlan(texto) {
  return String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizarPlan(payload = {}, parcial = false) {
  const data = {};
  if (!parcial || payload.nombre !== undefined) {
    if (!payload.nombre?.trim()) throw ApiError.badRequest('El nombre es requerido');
    data.nombre = payload.nombre.trim();
  }
  if (!parcial || payload.codigo !== undefined || payload.nombre !== undefined) {
    data.codigo = payload.codigo?.trim() ? slugPlan(payload.codigo) : slugPlan(payload.nombre);
    if (!data.codigo) throw ApiError.badRequest('El codigo es requerido');
  }
  if (!parcial || payload.gramaje_min !== undefined) {
    const gramajeMin = Number(payload.gramaje_min);
    if (!Number.isInteger(gramajeMin) || gramajeMin <= 0) {
      throw ApiError.badRequest('gramaje_min debe ser un entero positivo');
    }
    data.gramaje_min = gramajeMin;
  }
  if (!parcial || payload.gramaje_max !== undefined) {
    const gramajeMax = payload.gramaje_max === null || payload.gramaje_max === '' || payload.gramaje_max === undefined
      ? null
      : Number(payload.gramaje_max);
    if (gramajeMax !== null && (!Number.isInteger(gramajeMax) || gramajeMax <= 0)) {
      throw ApiError.badRequest('gramaje_max debe ser un entero positivo o null');
    }
    data.gramaje_max = gramajeMax;
  }
  if (data.gramaje_max !== undefined && data.gramaje_max !== null && data.gramaje_min !== undefined && data.gramaje_max < data.gramaje_min) {
    throw ApiError.badRequest('gramaje_max no puede ser menor a gramaje_min');
  }
  if (payload.descripcion !== undefined) data.descripcion = payload.descripcion?.trim() || null;
  if (payload.incluye_postre !== undefined) data.incluye_postre = Boolean(payload.incluye_postre);
  if (payload.incluye_bebida !== undefined) data.incluye_bebida = Boolean(payload.incluye_bebida);
  if (payload.activo !== undefined) data.activo = Boolean(payload.activo);
  if (payload.orden !== undefined) data.orden = Number.isFinite(Number(payload.orden)) ? Number(payload.orden) : 0;
  return data;
}

export const getPlanes = asyncHandler(async (req, res) => {
  const incluirInactivos = req.query.activo !== 'true';
  sendSuccess(res, await repo.findAll({ incluirInactivos }), 'Planes obtenidos');
});

export const createPlan = asyncHandler(async (req, res) => {
  const data = normalizarPlan(req.body);
  const existe = await repo.findByCodigo(data.codigo);
  if (existe) throw ApiError.conflict(`Ya existe un plan con codigo "${data.codigo}"`);
  sendCreated(res, await repo.create(data), 'Plan creado');
});

export const updatePlan = asyncHandler(async (req, res) => {
  const actual = await repo.findById(req.params.id);
  if (!actual) throw ApiError.notFound('Plan no encontrado');
  const data = normalizarPlan(req.body, true);
  if (Object.keys(data).length === 0) throw ApiError.badRequest('No hay campos validos para actualizar');
  if (data.codigo && data.codigo !== actual.codigo) {
    const existe = await repo.findByCodigo(data.codigo);
    if (existe && Number(existe.id) !== Number(req.params.id)) {
      throw ApiError.conflict(`Ya existe un plan con codigo "${data.codigo}"`);
    }
  }
  if (data.gramaje_max !== undefined && data.gramaje_max !== null) {
    const gramajeMin = data.gramaje_min ?? actual.gramaje_min;
    if (data.gramaje_max < gramajeMin) throw ApiError.badRequest('gramaje_max no puede ser menor a gramaje_min');
  }
  if (data.gramaje_min !== undefined) {
    const gramajeMax = data.gramaje_max !== undefined ? data.gramaje_max : actual.gramaje_max;
    if (gramajeMax !== null && gramajeMax < data.gramaje_min) {
      throw ApiError.badRequest('gramaje_max no puede ser menor a gramaje_min');
    }
  }
  sendSuccess(res, await repo.update(req.params.id, data), 'Plan actualizado');
});

export const deletePlan = asyncHandler(async (req, res) => {
  const actual = await repo.findById(req.params.id);
  if (!actual) throw ApiError.notFound('Plan no encontrado');
  sendSuccess(res, await repo.deactivate(req.params.id), 'Plan desactivado');
});
