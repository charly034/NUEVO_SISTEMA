import { getClient } from '../../database/connection.js';
import * as platosRepository from './platos.repository.js';
import { borrarImagenPlato, guardarImagenPlato } from './platos-imagen.service.js';
import * as auditoriaService from '../admin-auditoria/admin-auditoria.service.js';
import { ApiError } from '../../utils/ApiError.js';

export const getAllPlatos = async ({ page = 1, limit = 20, activo, search, tag, tipo, disponibilidad, sort_by, sort_dir } = {}) => {
  const pageNum  = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset   = (pageNum - 1) * limitNum;

  const [platos, total] = await Promise.all([
    platosRepository.findAll({ limit: limitNum, offset, activo, search, tag, tipo, disponibilidad, sort_by, sort_dir }),
    platosRepository.countAll({ activo, search, tag, tipo, disponibilidad }),
  ]);

  return {
    platos,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

export const getPlatoById = async (id) => {
  const plato = await platosRepository.findById(id);
  if (!plato) throw ApiError.notFound(`Plato con id ${id} no encontrado`);
  return plato;
};

export const createPlato = async (data, file = null, adminUser = null) => {
  const foto_url = file ? await guardarImagenPlato(file, data.nombre) : data.foto_url;

  // El plato y su vianda "general" (sin guarnicion/salsa, empresa_id NULL) se
  // crean en UNA transaccion: asi el plato queda usable en el diseño de menu al
  // instante, sin el paso manual de "asociar una vianda" (evita el error "no
  // tiene una vianda activa" al agregarlo a un menu). Ver decision del
  // /plan-eng-review 2026-07-18 en docs/ai/91-spec-menu-compuesto.md.
  const client = await getClient();
  let plato;
  try {
    await client.query('BEGIN');
    plato = await platosRepository.create({ ...data, foto_url }, client.query.bind(client));
    await client.query('INSERT INTO viandas (plato_id) VALUES ($1)', [plato.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'crear',
    entidad_tipo: 'plato',
    entidad_id: plato.id,
    resumen: `Creó el plato ${plato.nombre}`,
    despues: plato,
  });
  return plato;
};

// SQLSTATE 23514 (check_violation) es lo que el trigger platos_bloquear_desactivacion
// levanta (ver migración create-viandas-table) cuando el plato está usado por una
// vianda activa -- se traduce a 409, mismo patrón que el bloqueo de borrado en uso.
export const updatePlato = async (id, data, file = null, adminUser = null) => {
  const plato = await platosRepository.findById(id);
  if (!plato) throw ApiError.notFound(`Plato con id ${id} no encontrado`);

  const fields = { ...data };
  if (file) {
    fields.foto_url = await guardarImagenPlato(file, data.nombre || plato.nombre);
    await borrarImagenPlato(plato.foto_url);
  }

  let actualizado;
  try {
    actualizado = await platosRepository.update(id, fields);
  } catch (err) {
    if (err.code === '23514') throw ApiError.conflict(err.message);
    throw err;
  }
  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'actualizar',
    entidad_tipo: 'plato',
    entidad_id: id,
    resumen: `Actualizó el plato ${actualizado.nombre}`,
    antes: plato,
    despues: actualizado,
  });
  return actualizado;
};

export const deletePlato = async (id, adminUser = null) => {
  const plato = await platosRepository.findById(id);
  if (!plato) throw ApiError.notFound(`Plato con id ${id} no encontrado`);

  const enUso = await platosRepository.isUsedInMenuSemanal(id);
  if (enUso) {
    throw ApiError.conflict(
      `No se puede eliminar el plato "${plato.nombre}" porque está asignado en uno o más menús semanales`
    );
  }

  await platosRepository.remove(id);
  await borrarImagenPlato(plato.foto_url);
  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'eliminar',
    entidad_tipo: 'plato',
    entidad_id: id,
    resumen: `Eliminó el plato ${plato.nombre}`,
    antes: plato,
  });
};

export const getVisibilidadEmpresas = async (id) => {
  const plato = await platosRepository.findById(id);
  if (!plato) throw ApiError.notFound(`Plato con id ${id} no encontrado`);
  const empresas = await platosRepository.findVisibilidadEmpresas(id);
  return { plato_id: Number(id), visibilidad: empresas, todas: empresas.length === 0 };
};

export const setVisibilidadEmpresas = async (id, empresa_ids) => {
  const plato = await platosRepository.findById(id);
  if (!plato) throw ApiError.notFound(`Plato con id ${id} no encontrado`);
  await platosRepository.setVisibilidadEmpresas(id, empresa_ids);
  const empresas = await platosRepository.findVisibilidadEmpresas(id);
  return { plato_id: Number(id), visibilidad: empresas, todas: empresas.length === 0 };
};

export const getDisponibilidadLocal = async (id) => {
  const plato = await platosRepository.findById(id);
  if (!plato) throw ApiError.notFound(`Plato con id ${id} no encontrado`);
  const entradas = await platosRepository.findDisponibilidadLocal(id);
  return { plato_id: Number(id), entradas };
};

export const setDisponibilidadLocal = async (id, entradas) => {
  const plato = await platosRepository.findById(id);
  if (!plato) throw ApiError.notFound(`Plato con id ${id} no encontrado`);
  const guardadas = await platosRepository.setDisponibilidadLocal(id, entradas);
  return { plato_id: Number(id), entradas: guardadas };
};
