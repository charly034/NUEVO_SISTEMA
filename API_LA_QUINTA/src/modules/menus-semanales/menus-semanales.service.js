import * as repo from './menus-semanales.repository.js';
import * as platosRepository from '../platos/platos.repository.js';
import * as viandasRepository from '../viandas/viandas.repository.js';
import { setSlotVianda } from '../semana-opciones/semana-opciones.repository.js';
import { materializarFijosMenu } from '../categorias/categorias.repository.js';
import { materializarRotacionMenu } from '../categorias/categorias.service.js';
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
  // Sembrar los fijos "recurrentes" del catalogo como filas por-semana
  // (teardown Fase C): garantiza el invariante "todo menu tiene sus fijos
  // materializados", que es lo que hace seguro leer los fijos desde
  // menu_semanal_dias en vez del catalogo.
  await materializarFijosMenu(undefined, menu.id);
  // Sembrar tambien la rotacion de categorias con grupos para la semana del menu.
  await materializarRotacionMenu(undefined, menu.id, menu.fecha_inicio);
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

    // Copiar SOLO los especiales (opcion IS NOT NULL), llevando su categoria y
    // su vianda anclada. Los fijos NO se copian: son "recurrentes" y se
    // siembran frescos del catalogo mas abajo (teardown Fase C/D). Sin el
    // AND opcion IS NOT NULL, tras materializar el origen se copiarian los
    // fijos con categoria_id/vianda_id perdidos.
    await client.query(
      `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id, categoria_id, vianda_id)
       SELECT $1, dia, opcion, plato_id, categoria_id, vianda_id
       FROM menu_semanal_dias
       WHERE menu_semanal_id = $2 AND opcion IS NOT NULL
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

    // Sembrar los fijos del catalogo en la semana nueva (recurrentes).
    await materializarFijosMenu(client, nuevo.id);

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
       WHERE msd.menu_semanal_id = $3 AND msd.opcion IS NOT NULL
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
    // Rotacion: mejor-esfuerzo, fuera de la transaccion (no debe abortar el
    // duplicado si una categoria cambia justo ahora).
    await materializarRotacionMenu(undefined, nuevo.id, nuevo.fecha_inicio);
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

export const getDisenoMenuSemanal = async (id) => {
  const diseno = await repo.findDisenoById(id);
  if (!diseno) throw ApiError.notFound(`Menú semanal con id ${id} no encontrado`);
  return diseno;
};

export const agregarPlatoDia = async (menuSemanalId, { dia, opcion = 'A', plato_id, guarnicion_modo_override = null, guarnicion_fija_override_id = null, salsa_modo_override = null, salsa_fija_override_id = null, allow_duplicate = false }, adminUser = null) => {
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
  const tieneVianda = await viandasRepository.existsActivaParaPlato(plato_id);
  if (!tieneVianda) throw ApiError.conflict(`El plato "${plato.nombre}" no tiene una vianda activa`);

  if (!allow_duplicate) {
    const existentes = await repo.findPlatoEnDia(menuSemanalId, dia, plato_id);
    if (existentes.length > 0) {
      const err = ApiError.conflict(
        `"${plato.nombre}" ya está en el menú del ${dia}. Podés agregarlo de nuevo solo si lo limitás a empresas específicas que no se solapan con los slots existentes.`
      );
      err.code = 'PLATO_DUPLICADO';
      err.existentes = existentes;
      throw err;
    }
  }

  const fecha_servicio = calcularFechaServicio(menu.fecha_inicio, dia);

  const resultado = await repo.agregarPlato(menuSemanalId, dia, opcion, plato_id, {
    guarnicionModoOverride: guarnicion_modo_override,
    guarnicionFijaOverrideId: guarnicion_fija_override_id,
    salsaModoOverride: salsa_modo_override,
    salsaFijaOverrideId: salsa_fija_override_id,
  });

  // Los especiales se ofrecen como vianda por defecto (decision 2026-07-13):
  // si el plato tiene una vianda general activa en el catalogo, se ancla al
  // slot apenas se crea -- vianda_activa arranca en true sin que el admin
  // tenga que ir a activarla a mano despues de agregar el plato.
  const viandaGeneral = await viandasRepository.findGeneralActivaParaPlato(plato_id);
  if (viandaGeneral) {
    await setSlotVianda(resultado.id, viandaGeneral.id);
  }

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

export const setEmpresasSlot = async (menuSemanalId, dia, opcion, { empresa_ids = [] }, adminUser = null) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const slotId = await repo.findSlotId(menuSemanalId, dia, opcion);
  if (!slotId) throw ApiError.notFound(`No hay plato en opción ${opcion} del ${dia} para este menú`);

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await repo.setEmpresasSlot(client, slotId, empresa_ids);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'actualizar_empresas_slot',
    entidad_tipo: 'menu_semanal',
    entidad_id: menuSemanalId,
    resumen: empresa_ids.length === 0
      ? `Slot ${dia} op. ${opcion}: visible para todas las empresas`
      : `Slot ${dia} op. ${opcion}: restringido a ${empresa_ids.length} empresa(s)`,
    despues: { slotId, empresa_ids },
  });

  return { slotId, empresa_ids };
};

export const actualizarGuarnicionSlot = async (menuSemanalId, dia, opcion, { guarnicion_modo_override, guarnicion_fija_override_id = null }, adminUser = null) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const slot = await repo.actualizarGuarnicionSlot(menuSemanalId, dia, opcion, guarnicion_modo_override, guarnicion_fija_override_id);
  if (!slot) throw ApiError.notFound(`No hay plato en opción ${opcion} del ${dia} para este menú`);

  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'actualizar_guarnicion_slot',
    entidad_tipo: 'menu_semanal',
    entidad_id: menuSemanalId,
    resumen: `Actualizó guarnición del ${dia} opción ${opcion}: ${guarnicion_modo_override ?? 'default'}`,
    despues: slot,
  });
  return slot;
};

export const actualizarSalsaSlot = async (menuSemanalId, dia, opcion, { salsa_modo_override, salsa_fija_override_id = null }, adminUser = null) => {
  const menu = await repo.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const slot = await repo.actualizarSalsaSlot(menuSemanalId, dia, opcion, salsa_modo_override, salsa_fija_override_id);
  if (!slot) throw ApiError.notFound(`No hay plato en opción ${opcion} del ${dia} para este menú`);

  await auditoriaService.registrarAdminAction({
    adminUser,
    accion: 'actualizar_salsa_slot',
    entidad_tipo: 'menu_semanal',
    entidad_id: menuSemanalId,
    resumen: `Actualizó salsa del ${dia} opción ${opcion}: ${salsa_modo_override ?? 'default'}`,
    despues: slot,
  });
  return slot;
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
