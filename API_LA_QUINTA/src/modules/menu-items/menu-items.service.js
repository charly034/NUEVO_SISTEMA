import * as repo from './menu-items.repository.js';
import * as categoriasRepository from '../categorias/categorias.repository.js';
import * as platosRepository from '../platos/platos.repository.js';
import * as viandasRepository from '../viandas/viandas.repository.js';
import * as menusSemanalesRepository from '../menus-semanales/menus-semanales.repository.js';
import * as empresasRepository from '../empresas/empresas.repository.js';
import { ApiError } from '../../utils/ApiError.js';

// Agrega un plato a una categoría desde la tabla (celda nueva). vianda_activa y
// disponible_por_kilo arrancan según los defaults de la categoría (mismo criterio
// que "especiales se ofrecen como vianda por defecto"): si el default es vianda
// activa y el plato tiene una vianda general en el catálogo, se ancla; si no,
// queda sin vianda y el admin la activa desde la celda (que crea una si falta).
export const agregar = async ({ menu_semanal_id, categoria_id, plato_id, dia = null, opcion = null }) => {
  const menu = await menusSemanalesRepository.findById(menu_semanal_id);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menu_semanal_id} no encontrado`);

  const plato = await platosRepository.findById(plato_id);
  if (!plato) throw ApiError.notFound(`Plato con id ${plato_id} no encontrado`);
  if (!plato.activo) throw ApiError.conflict(`El plato "${plato.nombre}" está inactivo`);

  const categoria = await categoriasRepository.findById(categoria_id);
  if (!categoria) throw ApiError.notFound(`Categoría con id ${categoria_id} no encontrada`);
  if (categoria.tipo_dato !== 'platos') {
    throw ApiError.badRequest('Solo se pueden agregar platos a categorías de tipo "platos"');
  }

  let vianda_id = null;
  if (categoria.default_vianda_activa !== false) {
    const v = await viandasRepository.findGeneralActivaParaPlato(plato_id);
    if (v) vianda_id = v.id;
  }
  const disponible_por_kilo = categoria.default_disponible_por_kilo !== false;

  try {
    return await repo.insertItem({ menu_semanal_id, categoria_id, plato_id, dia, opcion, vianda_id, disponible_por_kilo });
  } catch (e) {
    if (e.code === '23505') throw ApiError.conflict('Ya hay un plato en esa celda de la categoría');
    throw e;
  }
};

// Reasigna la categoría de una celda del menú (mover de "Sin categorizar" a una
// categoría, o entre categorías). categoriaId=null => bucket "Sin categorizar".
// Una fila de menu_semanal_dias es un plato, así que solo puede ir a una
// categoría de tipo_dato='platos'.
export const reasignarCategoria = async (id, categoriaId) => {
  const item = await repo.findById(id);
  if (!item) throw ApiError.notFound(`Item de menú con id ${id} no encontrado`);

  if (categoriaId != null) {
    const categoria = await categoriasRepository.findById(categoriaId);
    if (!categoria) throw ApiError.notFound(`Categoría con id ${categoriaId} no encontrada`);
    if (categoria.tipo_dato !== 'platos') {
      throw ApiError.badRequest('Solo se puede asignar un plato a una categoría de tipo "platos"');
    }
  }

  return repo.setCategoria(id, categoriaId ?? null);
};

// Borra una sola celda (un plato de un día). No toca el resto de la fila/opción.
export const eliminar = async (id) => {
  const item = await repo.findById(id);
  if (!item) throw ApiError.notFound(`Item de menú con id ${id} no encontrado`);
  await repo.remove(id);
};

// ── Excepciones de guarnición/salsa por empresa sobre una celda (T8) ──────────
//
// El cliente manda solo el slot_id: acá se resuelve la celda y de ella salen el
// ancla (menu, categoria, dia, opcion) y la guarda (plato_id_origen = el plato que
// la celda tiene HOY). Si mañana la rotación cambia ese plato, la excepción queda
// "stale" y la resolución la ignora (ver migración 1719000080000).

const cargarSlot = async (id) => {
  const slot = await repo.findById(id);
  if (!slot) throw ApiError.notFound(`Item de menú con id ${id} no encontrado`);
  if (slot.categoria_id == null) {
    throw ApiError.badRequest('No se pueden configurar excepciones por empresa en una celda sin categoría');
  }
  return slot;
};

export const listarExcepciones = async (id) => {
  const slot = await cargarSlot(id);
  return repo.findExcepciones(slot);
};

export const guardarExcepcion = async (id, empresaId, datos) => {
  // slot y empresa son lookups independientes -> en paralelo.
  const [slot, empresa] = await Promise.all([cargarSlot(id), empresasRepository.findById(empresaId)]);
  if (!empresa) throw ApiError.notFound(`Empresa con id ${empresaId} no encontrada`);
  if (!empresa.activo) throw ApiError.conflict(`La empresa "${empresa.nombre}" está inactiva`);

  // No tiene sentido una excepción para una empresa que ni siquiera recibe este
  // plato ese día (allowlist real de visibilidad).
  const ve = await repo.empresaVeSlot(slot.id, empresaId);
  if (!ve) {
    throw ApiError.conflict(`"${empresa.nombre}" no recibe este plato en este día, así que no puede tener una excepción`);
  }

  await repo.upsertExcepcion(slot, { empresa_id: empresaId, ...datos });
  return repo.findExcepciones(slot);
};

export const borrarExcepcion = async (id, empresaId) => {
  const slot = await cargarSlot(id);
  const borrada = await repo.deleteExcepcion(slot, empresaId);
  if (!borrada) throw ApiError.notFound('Esa empresa no tiene una excepción en esta celda');
  return repo.findExcepciones(slot);
};
