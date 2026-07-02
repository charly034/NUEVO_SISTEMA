import * as platosRepository from './platos.repository.js';
import { borrarImagenPlato, guardarImagenPlato } from './platos-imagen.service.js';
import { ApiError } from '../../utils/ApiError.js';

export const getAllPlatos = async ({ page = 1, limit = 20, activo, search, tag, tipo, sort_by, sort_dir } = {}) => {
  const pageNum  = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset   = (pageNum - 1) * limitNum;

  const [platos, total] = await Promise.all([
    platosRepository.findAll({ limit: limitNum, offset, activo, search, tag, tipo, sort_by, sort_dir }),
    platosRepository.countAll({ activo, search, tag, tipo }),
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

export const createPlato = async (data, file = null) => {
  const foto_url = file ? await guardarImagenPlato(file, data.nombre) : data.foto_url;
  return platosRepository.create({ ...data, foto_url });
};

export const updatePlato = async (id, data, file = null) => {
  const plato = await platosRepository.findById(id);
  if (!plato) throw ApiError.notFound(`Plato con id ${id} no encontrado`);

  const fields = { ...data };
  if (file) {
    fields.foto_url = await guardarImagenPlato(file, data.nombre || plato.nombre);
    await borrarImagenPlato(plato.foto_url);
  }

  return platosRepository.update(id, fields);
};

export const deletePlato = async (id) => {
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
};
