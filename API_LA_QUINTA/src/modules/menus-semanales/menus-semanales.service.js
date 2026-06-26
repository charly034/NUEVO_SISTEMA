import * as repo from './menus-semanales.repository.js';
import * as platosRepository from '../platos/platos.repository.js';
import * as historialRepo from './historial.repository.js';
import { calcularFechaServicio } from '../../utils/fecha.js';
import { ApiError } from '../../utils/ApiError.js';

// ── Menús semanales ───────────────────────────────────────────────

export const getAllMenusSemanales = async ({ page = 1, limit = 10, desde, hasta } = {}) => {
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const [menus, total] = await Promise.all([
    repo.findAll({ limit: limitNum, offset, desde, hasta }),
    repo.countAll({ desde, hasta }),
  ]);

  return {
    menus,
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  };
};

export const getMenuSemanalById = async (id) => {
  const menu = await repo.findByIdWithDias(id);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${id} no encontrado`);
  return menu;
};

export const createMenuSemanal = async (data, admin_id = null) => {
  return repo.create({ ...data, admin_id });
};

export const updateMenuSemanal = async (id, data, admin_id = null) => {
  const menu = await repo.findById(id);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${id} no encontrado`);
  return repo.update(id, data, admin_id);
};

export const deleteMenuSemanal = async (id) => {
  const deleted = await repo.remove(id);
  if (!deleted) throw ApiError.notFound(`Menú semanal con id ${id} no encontrado`);
};

export const cambiarEstadoMenu = async (id, estado, extra = {}) => {
  const ESTADOS = ['borrador', 'publicado', 'cerrado'];
  if (!ESTADOS.includes(estado)) {
    throw ApiError.badRequest(`Estado inválido. Opciones: ${ESTADOS.join(', ')}`);
  }

  const menu = await repo.findById(id);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${id} no encontrado`);

  // Validar transiciones permitidas
  const transiciones = { borrador: ['publicado'], publicado: ['borrador', 'cerrado'], cerrado: ['publicado'] };
  if (!transiciones[menu.estado].includes(estado)) {
    throw ApiError.conflict(`No se puede pasar de "${menu.estado}" a "${estado}"`);
  }

  // Permitir múltiples menús publicados (semana actual + semana siguiente)

  const datosExtra = {};
  if (Object.prototype.hasOwnProperty.call(extra, 'fecha_limite_pedidos')) {
    datosExtra.fecha_limite_pedidos = extra.fecha_limite_pedidos || null;
  }

  return repo.cambiarEstado(id, estado, datosExtra);
};

// ── Platos por día ────────────────────────────────────────────────

export const agregarPlatoDia = async (menuSemanalId, { dia, opcion = 'A', plato_id }) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const sinServicio = await repo.findSinServicio(menuSemanalId, dia);
  if (sinServicio) {
    throw ApiError.conflict(
      `El ${dia} está marcado como sin servicio${sinServicio.motivo ? ` (${sinServicio.motivo})` : ''}. Quitá el día sin servicio primero.`
    );
  }

  const plato = await platosRepository.findById(plato_id);
  if (!plato) throw ApiError.notFound(`Plato con id ${plato_id} no encontrado`);
  if (!plato.activo) throw ApiError.conflict(`El plato "${plato.nombre}" está inactivo`);

  const fecha_servicio = calcularFechaServicio(menu.fecha_inicio, dia);

  const resultado = await repo.agregarPlato(menuSemanalId, dia, opcion, plato_id);

  // Registrar en el historial permanente
  await historialRepo.registrar({
    plato_id,
    plato_nombre_snapshot: plato.nombre,
    menu_semanal_id: menuSemanalId,
    dia,
    opcion,
    fecha_servicio,
  });

  return { ...resultado, plato_nombre: plato.nombre, fecha_servicio };
};

export const quitarPlatoDia = async (menuSemanalId, dia, opcion) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const deleted = await repo.quitarPlato(menuSemanalId, dia, opcion);
  if (!deleted) {
    throw ApiError.notFound(`No hay plato en opción ${opcion} del ${dia} para este menú semanal`);
  }
  // El historial NO se toca: si se quitó un plato de la planificación,
  // el registro histórico de que alguna vez estuvo asignado se conserva.
};

export const getPlatosByDia = async (menuSemanalId, dia) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);
  return repo.findPlatosByDia(menuSemanalId, dia);
};

// ── Días sin servicio ─────────────────────────────────────────────

export const marcarSinServicio = async (menuSemanalId, { dia, motivo }) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  await repo.quitarTodosLosPlatosDelDia(menuSemanalId, dia);
  return repo.agregarSinServicio(menuSemanalId, dia, motivo);
};

export const quitarSinServicio = async (menuSemanalId, dia) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const deleted = await repo.quitarSinServicio(menuSemanalId, dia);
  if (!deleted) {
    throw ApiError.notFound(`El ${dia} no está marcado como sin servicio en este menú semanal`);
  }
};

// ── Historial ─────────────────────────────────────────────────────

export const getHistorialPorPlato = async (platoId) => {
  const plato = await platosRepository.findById(platoId);
  if (!plato) throw ApiError.notFound(`Plato con id ${platoId} no encontrado`);

  const historial = await historialRepo.findByPlato(platoId);
  return { plato, historial };
};

export const getPlatosUsados = async (filtros = {}) => {
  return historialRepo.findUsados(filtros);
};

export const getPlatosNoUsados = async (filtros = {}) => {
  return historialRepo.findNoUsados(filtros);
};
