import * as repo from './viandas.repository.js';
import * as platosRepo from '../platos/platos.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const normalizarNombre = (nombre) => (typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null);

// SQLSTATE 23505 (unique_violation) es el índice único parcial
// viandas_plato_empresa_activo_idx (ver create-viandas-table); 23514 (check_violation)
// es el trigger de bloqueo bidireccional o el constraint salsa_id/salsa_libre.
const traducirErrorBD = (err) => {
  if (err.code === '23505') return ApiError.conflict('Ya existe una vianda activa para este plato y empresa');
  if (err.code === '23514') return ApiError.conflict(err.message);
  return err;
};

export const getAllViandas = (filters) => repo.findAll(filters);

export const getViandaById = async (id) => {
  const vianda = await repo.findById(id);
  if (!vianda) throw ApiError.notFound(`Vianda con id ${id} no encontrada`);
  return vianda;
};

export const createVianda = async (data) => {
  const plato = await platosRepo.findById(data.plato_id);
  if (!plato) throw ApiError.notFound(`Plato con id ${data.plato_id} no encontrado`);
  if (!plato.activo) throw ApiError.conflict(`El plato "${plato.nombre}" está inactivo`);

  try {
    return await repo.create({ ...data, nombre_vianda: normalizarNombre(data.nombre_vianda) });
  } catch (err) {
    throw traducirErrorBD(err);
  }
};

export const updateVianda = async (id, data) => {
  const actual = await repo.findById(id);
  if (!actual) throw ApiError.notFound(`Vianda con id ${id} no encontrada`);

  const fields = { ...data };
  if ('nombre_vianda' in fields) fields.nombre_vianda = normalizarNombre(fields.nombre_vianda);

  try {
    return await repo.update(id, fields);
  } catch (err) {
    throw traducirErrorBD(err);
  }
};
