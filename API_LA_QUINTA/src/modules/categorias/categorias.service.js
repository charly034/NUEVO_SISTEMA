import { query } from '../../database/connection.js';
import * as repo from './categorias.repository.js';
import { findRotacionConfig } from '../grupos-rotativos/grupos-rotativos.repository.js';
import { calcularIndiceRotacion } from '../grupos-rotativos/grupos-rotativos.service.js';
import * as platosRepository from '../platos/platos.repository.js';
import * as viandasRepository from '../viandas/viandas.repository.js';
import * as menusSemanalesRepository from '../menus-semanales/menus-semanales.repository.js';
import { ApiError } from '../../utils/ApiError.js';

// ── Slug ────────────────────────────────────────────────────────────────

// Deriva un slug base del nombre: sin acentos, minúsculas, no-alfanumérico -> '-'.
// Se recorta a 40 para dejar lugar al sufijo -{n} (columna slug es VARCHAR(50)).
export function slugify(texto) {
  return String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'categoria';
}

async function generarSlugUnico(base) {
  const existentes = new Set(await repo.findSlugsQueEmpiezan(base));
  if (!existentes.has(base)) return base;
  let n = 2;
  while (existentes.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

// ── Motor de rotación (funciones puras, testeables sin base) ────────────

// Número de semana ISO 8601 de una fecha (lunes como primer día). Se usa para
// el criterio pares/impares: "semana ISO par" es autoexplicable y no depende de
// ninguna fecha ancla configurada.
export function numeroSemanaISO(fecha) {
  const d = new Date(fecha);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diaNr = (target.getUTCDay() + 6) % 7; // lunes=0 .. domingo=6
  target.setUTCDate(target.getUTCDate() - diaNr + 3); // jueves de esta semana ISO
  const primerJueves = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const primerDiaNr = (primerJueves.getUTCDay() + 6) % 7;
  primerJueves.setUTCDate(primerJueves.getUTCDate() - primerDiaNr + 3);
  return 1 + Math.round((target - primerJueves) / (7 * 24 * 60 * 60 * 1000));
}

// Normaliza una fecha ('YYYY-MM-DD' o Date de pg) a string 'YYYY-MM-DD' (UTC).
export function fechaISO(fecha) {
  if (fecha == null) return null;
  return new Date(fecha).toISOString().slice(0, 10);
}

// Nº de semana del mes (1..5) del lunes de esa semana.
export function semanaDelMes(fecha) {
  const d = new Date(fecha);
  return Math.floor((d.getUTCDate() - 1) / 7) + 1;
}

// Dado el set de grupos de una categoría y la semana, devuelve los que están
// activos según su criterio. `forzarGrupoId` (excepción manual) gana sobre todo:
// si viene, sólo ese grupo está activo esa semana.
//   - siempre       -> siempre activo
//   - pares/impares -> por nº de semana ISO del año
//   - cada_n        -> cada `periodo` semanas desde la fecha ancla, con offset
//                      (ciclo_offset). Ej: cada 15 días = periodo 2.
//   - rango_fechas  -> la semana solapa [fecha_desde, fecha_hasta]
//   - semana_mes    -> la Nª semana del mes (semana_del_mes), y si `meses` está
//                      seteado, sólo en esos meses
//   - ciclo         -> rotación N-aria entre los grupos 'ciclo' desde el ancla
export function gruposActivosParaSemana(grupos, fechaInicioSemana, fechaAncla = null, forzarGrupoId = null) {
  const activos = grupos.filter((g) => g.activo);

  if (forzarGrupoId != null) {
    return activos.filter((g) => g.id === forzarGrupoId);
  }

  const isoWeek = numeroSemanaISO(fechaInicioSemana);
  const semMes = semanaDelMes(fechaInicioSemana);
  const mes = new Date(fechaInicioSemana).getUTCMonth() + 1; // 1..12
  const inicioSem = fechaISO(fechaInicioSemana);
  const finSem = fechaISO(new Date(new Date(fechaInicioSemana).getTime() + 6 * 24 * 60 * 60 * 1000));
  const nCiclo = activos.filter((g) => g.criterio === 'ciclo').length;
  const idxCiclo = (nCiclo > 0 && fechaAncla != null)
    ? calcularIndiceRotacion(fechaAncla, fechaInicioSemana, nCiclo)
    : null;

  return activos.filter((g) => {
    switch (g.criterio) {
      case 'siempre': return true;
      case 'pares': return isoWeek % 2 === 0;
      case 'impares': return isoWeek % 2 === 1;
      case 'ciclo':
        return idxCiclo != null && ((g.ciclo_offset ?? 0) % nCiclo) === idxCiclo;
      case 'cada_n': {
        const periodo = g.periodo ?? 0;
        if (periodo <= 0 || fechaAncla == null) return false;
        return calcularIndiceRotacion(fechaAncla, fechaInicioSemana, periodo) === ((g.ciclo_offset ?? 0) % periodo);
      }
      case 'rango_fechas': {
        const desde = fechaISO(g.fecha_desde);
        const hasta = fechaISO(g.fecha_hasta);
        if (!desde || !hasta) return false;
        return desde <= finSem && hasta >= inicioSem; // solapamiento con la semana
      }
      case 'semana_mes': {
        if ((g.semana_del_mes ?? 0) !== semMes) return false;
        const meses = g.meses;
        return !meses || meses.length === 0 || meses.includes(mes);
      }
      default: return false;
    }
  });
}

// ── Categorías: lectura ─────────────────────────────────────────────────

export const listar = (filtros = {}) => {
  const norm = {};
  if (filtros.tipo_dato) norm.tipo_dato = filtros.tipo_dato;
  if (filtros.activo !== undefined) norm.activo = filtros.activo === 'true';
  if (filtros.incluir_sistema !== undefined) norm.incluir_sistema = filtros.incluir_sistema === 'true';
  return repo.findAll(norm);
};

export const obtenerConDetalle = async (id) => {
  const categoria = await repo.findByIdConDetalle(id);
  if (!categoria) throw ApiError.notFound(`Categoría con id ${id} no encontrada`);
  return categoria;
};

// ── Categorías: escritura ───────────────────────────────────────────────

export const crear = async ({ nombre, alcance, menu_semanal_id, modo, usa_opcion, orden, defaults }) => {
  const slug = await generarSlugUnico(slugify(nombre));
  // orden = max+1 salvo que el llamador pida uno explícito (>0): las categorías
  // nuevas se crean al final y después se reordenan por drag (Fase G).
  const ordenFinal = orden && orden > 0 ? orden : (await repo.maxOrden()) + 1;
  // Las categorías custom siempre son de platos (van a menu_semanal_dias). Los
  // otros tipo_dato (guarniciones/salsas) solo existen como categorías de
  // sistema sobre sus tablas propias.
  const categoria = await repo.create({
    nombre, slug, tipo_dato: 'platos', alcance, menu_semanal_id, modo, usa_opcion, orden: ordenFinal,
  });
  if (defaults) await repo.upsertDefaults(categoria.id, defaults);
  return repo.findById(categoria.id);
};

export const actualizar = async (id, { defaults, ...campos }) => {
  const categoria = await repo.findById(id);
  if (!categoria) throw ApiError.notFound(`Categoría con id ${id} no encontrada`);
  // es_sistema: se permite renombrar/reordenar, pero nunca cambiar tipo_dato
  // (inmutable para todos, ni siquiera está en el schema) ni borrar.
  if (Object.keys(campos).length > 0) await repo.update(id, campos);
  if (defaults) await repo.upsertDefaults(id, defaults);
  return repo.findById(id);
};

export const eliminar = async (id) => {
  const categoria = await repo.findById(id);
  if (!categoria) throw ApiError.notFound(`Categoría con id ${id} no encontrada`);
  if (categoria.es_sistema) {
    throw ApiError.forbidden('Las categorías del sistema no se pueden eliminar');
  }
  await repo.remove(id);
};

export const duplicar = async (id, { nombre } = {}) => {
  const origen = await repo.findById(id);
  if (!origen) throw ApiError.notFound(`Categoría con id ${id} no encontrada`);
  const nombreNuevo = nombre?.trim() || `${origen.nombre} (copia)`;
  const slug = await generarSlugUnico(slugify(origen.slug.replace(/-\d+$/, '') || origen.slug));
  return repo.duplicar(id, { nombre: nombreNuevo, slug });
};

// ── Grupos ──────────────────────────────────────────────────────────────

async function asegurarCategoria(categoriaId) {
  const categoria = await repo.findById(categoriaId);
  if (!categoria) throw ApiError.notFound(`Categoría con id ${categoriaId} no encontrada`);
  return categoria;
}

async function asegurarGrupoDeCategoria(categoriaId, grupoId) {
  const grupo = await repo.findGrupoById(grupoId);
  if (!grupo || grupo.categoria_id !== categoriaId) {
    throw ApiError.notFound(`Grupo con id ${grupoId} no encontrado en la categoría ${categoriaId}`);
  }
  return grupo;
}

export const crearGrupo = async (categoriaId, datos) => {
  const categoria = await asegurarCategoria(categoriaId);
  const grupo = await repo.createGrupo({ categoria_id: categoriaId, ...datos });
  // Auto: una categoría con rotación se muestra como lista semanal (los platos
  // del grupo activo cambian por semana, sin día fijo). Para que esas filas se
  // vean, la categoría pasa a modo "mismo plato todos los días". Solo se ajusta
  // en categorías custom sin opción (nunca Especiales/Fijos ni matriz A/B/C,
  // que se romperían) y solo si todavía no está en ese modo.
  if (!categoria.es_sistema && !categoria.usa_opcion && categoria.modo !== 'plato_unico_todos_los_dias') {
    await repo.update(categoriaId, { modo: 'plato_unico_todos_los_dias' });
  }
  return grupo;
};

export const actualizarGrupo = async (categoriaId, grupoId, fields) => {
  await asegurarGrupoDeCategoria(categoriaId, grupoId);
  return repo.updateGrupo(grupoId, fields);
};

export const eliminarGrupo = async (categoriaId, grupoId) => {
  await asegurarGrupoDeCategoria(categoriaId, grupoId);
  await repo.removeGrupo(grupoId);
};

export const agregarPlatoAGrupo = async (categoriaId, grupoId, platoId, orden) => {
  await asegurarGrupoDeCategoria(categoriaId, grupoId);
  const plato = await platosRepository.findById(platoId);
  if (!plato) throw ApiError.notFound(`Plato con id ${platoId} no encontrado`);
  return repo.agregarPlatoAGrupo(grupoId, platoId, orden);
};

export const quitarPlatoDeGrupo = async (categoriaId, grupoId, platoId) => {
  await asegurarGrupoDeCategoria(categoriaId, grupoId);
  return repo.quitarPlatoDeGrupo(grupoId, platoId);
};

// Resuelve los grupos activos de una categoría para una semana, con sus platos.
export const resolverGruposActivos = async (categoriaId, fechaInicioSemana) => {
  await asegurarCategoria(categoriaId);
  const grupos = await repo.findGruposDeCategoria(categoriaId, { soloActivos: true });
  const config = await findRotacionConfig();
  const activos = gruposActivosParaSemana(grupos, fechaInicioSemana, config?.fecha_ancla ?? null);
  return Promise.all(activos.map(async (g) => ({ ...g, platos: await repo.findPlatosDeGrupo(g.id) })));
};

// ── Materialización de rotación en un menú (Fase H) ─────────────────────
// Para cada categoría con grupos, resuelve los grupos activos de esa semana
// (respetando la excepción manual si existe) e inserta sus platos como filas
// de menu_semanal_dias (dia=NULL, marcadas con origen_categoria_grupo_id). La
// vianda/por-kilo iniciales salen de los defaults de la categoría. Idempotente.
export const materializarRotacionMenu = async (db = query, menuSemanalId, fechaInicioSemana, categoriaIdFiltro = null) => {
  const config = await findRotacionConfig();
  const ancla = config?.fecha_ancla ?? null;
  const ids = categoriaIdFiltro ? [categoriaIdFiltro] : await repo.findCategoriasConGrupos();

  for (const catId of ids) {
    // Mejor-esfuerzo por categoría: si una categoría/grupo desaparece justo
    // ahora (poco probable en producción, posible bajo tests en paralelo), se
    // saltea sin frenar la siembra del resto.
    try {
      const categoria = await repo.findById(catId);
      if (!categoria) continue;
      const grupos = await repo.findGruposDeCategoria(catId, { soloActivos: true });
      if (grupos.length === 0) continue;

      const forzar = await repo.findSeleccionSemana(menuSemanalId, catId);
      const activos = gruposActivosParaSemana(grupos, fechaInicioSemana, ancla, forzar);
      const viandaDefault = categoria.default_vianda_activa !== false;
      const kiloDefault = categoria.default_disponible_por_kilo !== false;

      for (const g of activos) {
        const platos = await repo.findPlatosDeGrupo(g.id);
        for (const p of platos) {
          let vianda_id = null;
          if (viandaDefault) {
            const v = await viandasRepository.findGeneralActivaParaPlato(p.plato_id);
            if (v) vianda_id = v.id;
          }
          await repo.insertFilaRotacion(db, {
            menu_semanal_id: menuSemanalId,
            categoria_id: catId,
            plato_id: p.plato_id,
            dia: null,
            vianda_id,
            disponible_por_kilo: kiloDefault,
            origen_categoria_grupo_id: g.id,
          });
        }
      }
    } catch (e) {
      if (e?.code !== '23503' && e?.code !== '23505') throw e; // solo tolera FK/único
    }
  }
};

async function fechaInicioDeMenu(menuSemanalId) {
  const menu = await menusSemanalesRepository.findById(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);
  return menu.fecha_inicio;
}

// Re-siembra la rotación de una categoría en un menú: borra lo materializado
// antes (no toca lo cargado a mano) y vuelve a resolver con la config actual.
export const resembrarRotacionCategoria = async (menuSemanalId, categoriaId) => {
  await asegurarCategoria(categoriaId);
  const fecha = await fechaInicioDeMenu(menuSemanalId);
  await repo.desmaterializarRotacion(query, menuSemanalId, categoriaId);
  await materializarRotacionMenu(query, menuSemanalId, fecha, categoriaId);
};

// ── Excepción manual de rotación por semana ─────────────────────────────
export const forzarGrupoSemana = async (menuSemanalId, categoriaId, categoriaGrupoId) => {
  const grupo = await repo.findGrupoById(categoriaGrupoId);
  if (!grupo || grupo.categoria_id !== categoriaId) {
    throw ApiError.badRequest('El grupo indicado no pertenece a esta categoría');
  }
  await repo.upsertSeleccionSemana(menuSemanalId, categoriaId, categoriaGrupoId);
  await resembrarRotacionCategoria(menuSemanalId, categoriaId);
};

export const quitarGrupoForzadoSemana = async (menuSemanalId, categoriaId) => {
  await repo.deleteSeleccionSemana(menuSemanalId, categoriaId);
  await resembrarRotacionCategoria(menuSemanalId, categoriaId);
};
