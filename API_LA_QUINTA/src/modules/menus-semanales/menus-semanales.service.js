import * as repo from './menus-semanales.repository.js';
import * as platosRepository from '../platos/platos.repository.js';
import * as historialRepo from './historial.repository.js';
import * as notificacionesService from '../notificaciones/notificaciones.service.js';
import * as auditoriaService from '../admin-auditoria/admin-auditoria.service.js';
import { calcularFechaServicio } from '../../utils/fecha.js';
import { ApiError } from '../../utils/ApiError.js';
import { getClient } from '../../database/connection.js';

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

export const createMenuSemanal = async (data, admin_id = null, adminUser = null) => {
  const menu = await repo.create({ ...data, admin_id });
  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'crear',
    entidad_tipo: 'menu_semanal',
    entidad_id: menu.id,
    resumen: `Creó el menú ${menu.nombre}`,
    despues: menu,
  });
  return menu;
};

export const updateMenuSemanal = async (id, data, admin_id = null, adminUser = null) => {
  const menu = await repo.findById(id);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${id} no encontrado`);
  const actualizado = await repo.update(id, data, admin_id);
  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'actualizar',
    entidad_tipo: 'menu_semanal',
    entidad_id: id,
    resumen: `Actualizó el menú ${actualizado.nombre}`,
    antes: menu,
    despues: actualizado,
  });
  return actualizado;
};

export const deleteMenuSemanal = async (id, adminUser = null) => {
  const menu = await repo.findByIdWithDias(id);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${id} no encontrado`);
  const deleted = await repo.remove(id);
  if (!deleted) throw ApiError.notFound(`Menú semanal con id ${id} no encontrado`);
  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'eliminar',
    entidad_tipo: 'menu_semanal',
    entidad_id: id,
    resumen: `Eliminó el menú ${menu.nombre}`,
    antes: menu,
  });
};

export const duplicarMenuSemanal = async (id, data, adminUser = null) => {
  const origen = await repo.findByIdWithDias(id);
  if (!origen) throw ApiError.notFound(`Menú semanal con id ${id} no encontrado`);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const existente = await client.query(
      'SELECT id FROM menus_semanales WHERE fecha_inicio = $1',
      [data.fecha_inicio]
    );
    if (existente.rows[0]) {
      throw ApiError.conflict(`Ya existe un menú para la semana ${data.fecha_inicio}`);
    }

    const creadoResult = await client.query(
      `INSERT INTO menus_semanales (
        nombre, fecha_inicio, fecha_fin, estado, created_by_admin_id, updated_by_admin_id
      )
       VALUES ($1, $2, $3, 'borrador', $4, $4)
       RETURNING id, nombre, fecha_inicio, fecha_fin, estado, created_at, updated_at`,
      [data.nombre, data.fecha_inicio, data.fecha_fin, adminUser?.sub ?? null]
    );
    const nuevo = creadoResult.rows[0];

    await client.query(
      `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
       SELECT $1, dia, opcion, plato_id
       FROM menu_semanal_dias
       WHERE menu_semanal_id = $2
       ORDER BY dia, opcion`,
      [nuevo.id, id]
    );

    await client.query(
      `INSERT INTO menu_semanal_sin_servicio (menu_semanal_id, dia, motivo)
       SELECT $1, dia, motivo
       FROM menu_semanal_sin_servicio
       WHERE menu_semanal_id = $2`,
      [nuevo.id, id]
    );

    await client.query(
      `INSERT INTO historial_uso_platos (
        plato_id, plato_nombre_snapshot, menu_semanal_id, dia, opcion, fecha_servicio
      )
       SELECT
        msd.plato_id,
        p.nombre,
        $1,
        msd.dia,
        msd.opcion,
        ($2::date + (CASE msd.dia
          WHEN 'lunes' THEN 0 WHEN 'martes' THEN 1 WHEN 'miercoles' THEN 2
          WHEN 'jueves' THEN 3 WHEN 'viernes' THEN 4 WHEN 'sabado' THEN 5
          WHEN 'domingo' THEN 6 END) * INTERVAL '1 day')::date
       FROM menu_semanal_dias msd
       JOIN platos p ON p.id = msd.plato_id
       WHERE msd.menu_semanal_id = $3
       ON CONFLICT DO NOTHING`,
      [nuevo.id, data.fecha_inicio, id]
    );

    await auditoriaService.registrarAdminAction({
      adminUser,
      accion: 'duplicar',
      entidad_tipo: 'menu_semanal',
      entidad_id: nuevo.id,
      resumen: `Duplicó ${origen.nombre} hacia ${nuevo.nombre}`,
      antes: { menu_origen: origen.id, fecha_inicio: origen.fecha_inicio, fecha_fin: origen.fecha_fin },
      despues: nuevo,
      metadata: { origen_id: origen.id },
    }, client.query.bind(client));

    await client.query('COMMIT');
    return nuevo;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const cambiarEstadoMenu = async (id, estado, extra = {}, adminUser = null) => {
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

  const menuActualizado = await repo.cambiarEstado(id, estado, datosExtra);

  if (estado === 'publicado' && menu.estado !== 'publicado') {
    await notificacionesService.notificarMenuPublicado(menuActualizado);
  }

  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'cambiar_estado',
    entidad_tipo: 'menu_semanal',
    entidad_id: id,
    resumen: `Cambió el menú ${menu.nombre} de ${menu.estado} a ${estado}`,
    antes: menu,
    despues: menuActualizado,
  });

  return menuActualizado;
};

// ── Platos por día ────────────────────────────────────────────────

export const agregarPlatoDia = async (menuSemanalId, { dia, opcion = 'A', plato_id }, adminUser = null) => {
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

  const agregado = { ...resultado, plato_nombre: plato.nombre, fecha_servicio };
  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'agregar_plato',
    entidad_tipo: 'menu_semanal',
    entidad_id: menuSemanalId,
    resumen: `Agregó ${plato.nombre} al ${dia} opción ${opcion}`,
    despues: agregado,
  });
  return agregado;
};

export const quitarPlatoDia = async (menuSemanalId, dia, opcion, adminUser = null) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const anterior = await repo.findPlato(menuSemanalId, dia, opcion);
  const deleted = await repo.quitarPlato(menuSemanalId, dia, opcion);
  if (!deleted) {
    throw ApiError.notFound(`No hay plato en opción ${opcion} del ${dia} para este menú semanal`);
  }
  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'quitar_plato',
    entidad_tipo: 'menu_semanal',
    entidad_id: menuSemanalId,
    resumen: `Quitó la opción ${opcion} del ${dia}`,
    antes: anterior,
  });
  // El historial NO se toca: si se quitó un plato de la planificación,
  // el registro histórico de que alguna vez estuvo asignado se conserva.
};

export const getPlatosByDia = async (menuSemanalId, dia) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);
  return repo.findPlatosByDia(menuSemanalId, dia);
};

// ── Días sin servicio ─────────────────────────────────────────────

export const marcarSinServicio = async (menuSemanalId, { dia, motivo }, adminUser = null) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const platosPrevios = await repo.findPlatosByDia(menuSemanalId, dia);
  await repo.quitarTodosLosPlatosDelDia(menuSemanalId, dia);
  const sinServicio = await repo.agregarSinServicio(menuSemanalId, dia, motivo);
  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'marcar_sin_servicio',
    entidad_tipo: 'menu_semanal',
    entidad_id: menuSemanalId,
    resumen: `Marcó ${dia} como sin servicio`,
    antes: { platos: platosPrevios },
    despues: sinServicio,
  });
  return sinServicio;
};

export const quitarSinServicio = async (menuSemanalId, dia, adminUser = null) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const anterior = await repo.findSinServicio(menuSemanalId, dia);
  const deleted = await repo.quitarSinServicio(menuSemanalId, dia);
  if (!deleted) {
    throw ApiError.notFound(`El ${dia} no está marcado como sin servicio en este menú semanal`);
  }
  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'quitar_sin_servicio',
    entidad_tipo: 'menu_semanal',
    entidad_id: menuSemanalId,
    resumen: `Quitó sin servicio del ${dia}`,
    antes: anterior,
  });
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
