import * as repo from './semana-opciones.repository.js';
import * as gruposRotativosService from '../grupos-rotativos/grupos-rotativos.service.js';
import * as cocinaRepository from '../cocina/cocina.repository.js';
import * as menusSemanalesRepository from '../menus-semanales/menus-semanales.repository.js';
import * as viandasRepository from '../viandas/viandas.repository.js';
import * as categoriasRepository from '../categorias/categorias.repository.js';
import { calcularFechaServicio } from '../../utils/fecha.js';
import { ApiError } from '../../utils/ApiError.js';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

// ── Payload categorias[] (teardown Fase F: TablaSemana dinamica) ──────────
// Reshapea la data ya computada + las categorias custom en UN array que el
// frontend itera sin bloques hardcodeados. Cada entrada trae `render` (como
// dibujarla) y `tipo_item` (como se comportan sus celdas: slot vs fijo vs
// catalogo). Los campos viejos (dias/opciones/fijos/guarniciones/salsas)
// siguen en la respuesta para paridad/rollback.

// Como dibujar y como se comportan las celdas de una categoria.
function metaRender(cat) {
  if (cat.tipo_dato === 'guarniciones' || cat.tipo_dato === 'salsas') {
    return { render: 'lista_catalogo', tipo_item: 'catalogo' };
  }
  const esFijo = cat.slug === 'fijos-x-dia' || cat.slug === 'fijos-de-siempre';
  const tipo_item = esFijo ? 'fijo' : 'slot';
  let render;
  if (cat.usa_opcion) render = 'matriz';
  else if (cat.modo === 'plato_unico_todos_los_dias') render = 'lista_siempre';
  else render = 'lista_dia';
  return { render, tipo_item };
}

// Orden visual: lo maneja el campo `orden` de cada categoría (arrastrable desde
// la UI, Fase G). Las de sistema vienen sembradas 1..5; las custom se crean con
// orden = max+1 (van al final) y se reordenan por drag. "Sin categorizar" queda
// siempre al final.
const ORDEN_SIN_CATEGORIZAR = 1_000_000_000;
function ordenDisplay(cat) {
  return cat.orden ?? 0;
}

function celdaSlot(s) {
  return {
    slot_id: s.slot_id,
    dia: s.dia,
    opcion: s.opcion,
    plato_id: s.plato_id,
    plato_nombre: s.plato_nombre,
    vianda_id: s.vianda_id,
    nombre_vianda: s.nombre_vianda,
    guarnicion_id: s.guarnicion_id,
    salsa_id: s.salsa_id,
    salsa_libre: s.salsa_libre,
    vianda_activa: Boolean(s.vianda_id),
    disponible_por_kilo: s.disponible_por_kilo,
    empresas: s.empresas,
    visible_empresa_ids: s.visible_empresa_ids ?? [],
    categoria_id: s.categoria_id,
    // Cascada legible (T7/B1): modo efectivo + de QUÉ CAPA sale, resuelto en el
    // repositorio (no se recalcula en el front). procedencia: celda | vianda | plato |
    // ninguna. excepciones_empresas = excepciones por empresa vigentes sobre esta
    // celda; excepciones_stale = las que quedaron apuntando a un plato viejo tras una
    // rotación (no se aplican; el admin las reconfirma o borra).
    guarnicion_modo: s.guarnicion_modo,
    guarnicion_procedencia: s.guarnicion_procedencia,
    guarnicion_efectiva_id: s.guarnicion_efectiva_id,
    guarnicion_efectiva_nombre: s.guarnicion_efectiva_nombre,
    salsa_modo: s.salsa_modo,
    salsa_procedencia: s.salsa_procedencia,
    salsa_efectiva_id: s.salsa_efectiva_id,
    salsa_efectiva_nombre: s.salsa_efectiva_nombre,
    excepciones_empresas: s.excepciones_empresas ?? 0,
    excepciones_stale: s.excepciones_stale ?? 0,
  };
}

async function construirCategorias(menuSemanalId, dias, guarnicionesSemana, salsasSemana) {
  const cats = await categoriasRepository.findAll({ activo: true });
  const itemsCat = await repo.findItemsPlatosCategorizados(menuSemanalId);

  // Especiales + custom + "Sin categorizar", bucketeados por categoria_id.
  const porCategoria = new Map();
  for (const s of itemsCat) {
    const key = s.categoria_id ?? 'sin';
    if (!porCategoria.has(key)) porCategoria.set(key, []);
    porCategoria.get(key).push(celdaSlot(s));
  }

  // Fijos x dia (global fijo_dia + rotativos) y Fijos de siempre (global
  // siempre, dedup por plato, dia=null) -- mismo criterio de split que usaba
  // el frontend sobre dias[].fijos, ahora resuelto en el backend.
  const fijosXDiaItems = [];
  const siempreMap = new Map();
  for (const d of dias) {
    for (const f of d.fijos) {
      const esSiempre = f.origen === 'global' && f.categoria === 'siempre';
      if (esSiempre) {
        if (!siempreMap.has(f.plato_id)) siempreMap.set(f.plato_id, { ...f, dia: null });
      } else {
        fijosXDiaItems.push({ ...f, dia: d.dia });
      }
    }
  }
  const fijosSiempreItems = [...siempreMap.values()];

  const entradas = [];
  for (const cat of cats) {
    const meta = metaRender(cat);
    let items;
    if (cat.slug === 'fijos-x-dia') items = fijosXDiaItems;
    else if (cat.slug === 'fijos-de-siempre') items = fijosSiempreItems;
    else if (cat.tipo_dato === 'guarniciones') items = guarnicionesSemana;
    else if (cat.tipo_dato === 'salsas') items = salsasSemana;
    else items = porCategoria.get(cat.id) ?? []; // especiales + custom
    entradas.push({
      id: cat.id,
      nombre: cat.nombre,
      slug: cat.slug,
      tipo_dato: cat.tipo_dato,
      modo: cat.modo,
      usa_opcion: cat.usa_opcion,
      es_sistema: cat.es_sistema,
      render: meta.render,
      tipo_item: meta.tipo_item,
      orden_display: ordenDisplay(cat),
      defaults: {
        vianda_activa: cat.default_vianda_activa ?? true,
        disponible_por_kilo: cat.default_disponible_por_kilo ?? true,
        empresa_ids: cat.default_empresa_ids ?? null,
      },
      items,
    });
  }

  // Pseudo-categoria "Sin categorizar": filas con categoria_id NULL (quedaron
  // asi al borrar una categoria custom). Solo se muestra si tiene items.
  const sinItems = porCategoria.get('sin') ?? [];
  if (sinItems.length > 0) {
    entradas.push({
      id: null,
      nombre: 'Sin categorizar',
      slug: 'sin-categorizar',
      tipo_dato: 'platos',
      modo: 'plato_distinto_por_dia',
      usa_opcion: false,
      es_sistema: false,
      render: 'sin_categorizar',
      tipo_item: 'slot',
      orden_display: ORDEN_SIN_CATEGORIZAR,
      defaults: null,
      items: sinItems,
    });
  }

  entradas.sort((a, b) => a.orden_display - b.orden_display);
  return entradas;
}

export const getSemanaOpciones = async (menuSemanalId) => {
  const menu = await repo.findMenu(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const slots = await repo.findSlotsConEmpresas(menuSemanalId);

  // menu.fecha_inicio viene del driver de pg como objeto Date (columna DATE),
  // no como string -- calcularIndiceRotacion hace interpolacion de template
  // string asumiendo 'YYYY-MM-DD' y con un Date da NaN silencioso. Normalizar
  // una sola vez aca (bug real encontrado en verificacion manual en navegador).
  const fechaInicioStr = new Date(menu.fecha_inicio).toISOString().slice(0, 10);

  // "Fijos" tiene 2 fuentes distintas (hallazgo de /office-hours 2026-07-12,
  // corregido tras verificar contra datos reales -- 19 platos disponibilidad
  // fijo_dia en produccion, 0 usando ciclo_rotacion, el gap era real):
  //   1. Global (platos.disponibilidad='fijo_dia'/'siempre') -- no varia por
  //      semana, mismo dato que ya usa vista-semanal via findFijosYSiempre().
  //   2. ciclo_rotacion resuelto -- rota semana a semana, sistema nuevo.
  const fijosGlobales = await cocinaRepository.findFijosYSiempre();
  const sinServicioMap = await menusSemanalesRepository.findSinServicioMap(menuSemanalId);

  // vianda_activa de un FIJO: ancla por semana (menu_semanal_fijos_vianda),
  // no un atributo del catalogo. Hallazgo de sesion con el usuario viendo
  // datos reales: existsActivaParaPlato(plato_id) contestaba "¿este plato
  // tuvo ALGUNA vez una vianda activa?" (catalogo), no "¿se decidio
  // ofrecerlo como vianda ESTA semana?" -- daba falsos verdes con
  // composiciones viejas. Los especiales ya resuelven esto bien via
  // menu_semanal_dias.vianda_id (un anclaje por semana); esta tabla es el
  // equivalente para fijos, que no tienen fila propia en menu_semanal_dias.
  const fijosViandaMap = await repo.findFijosViandaMap(menuSemanalId);

  // Venta por kilo y visibilidad de fijos: hasta ahora eran default fijo
  // (por-kilo siempre true, sin excepcion) o propiedad de catalogo
  // (visibilidad via plato_empresa_visibilidad) -- el usuario senalo que
  // ambas cosas dejan de ser propiedad del plato/catalogo, son decisiones
  // por semana (mismo criterio ya aplicado a vianda_activa de fijos).
  const fijosSinKiloSet = await repo.findFijosSinKiloSet(menuSemanalId);
  const fijosVisibilidadMap = await repo.findFijosVisibilidadMap(menuSemanalId);

  // Guarniciones y salsas sueltas ofrecidas esta semana (venta local) --
  // no dependen del dia, son una lista unica para toda la semana (mismo
  // criterio que "Fijos de siempre": una fila por item, no por dia).
  const guarnicionesSemana = await repo.findGuarnicionesSemana(menuSemanalId);
  const salsasSemana = await repo.findSalsasSemana(menuSemanalId);

  // Ciclos rotativos no dependen de datos por-slot, se resuelven una vez por
  // dia (cantidad de ciclos configurados es chica y acotada, no escala con
  // el tamano del menu -- no es el mismo patron de N+1 que una query por fila).
  const rotativosPorDia = {};
  for (const dia of DIAS) {
    rotativosPorDia[dia] = await gruposRotativosService.listarCiclosConEstadoDelDia(dia, menuSemanalId, fechaInicioStr);
  }

  const dias = DIAS.map((dia) => {
    const fechaDia = calcularFechaServicio(fechaInicioStr, dia);
    const opcionesDelDia = slots.filter((s) => s.dia === dia);
    // Un plato con regla global fijo_dia/siempre que ADEMAS tiene un slot
    // especial ese mismo dia (misma precedencia ya resuelta en
    // vista-semanal.service.js): el especial es mas especifico para esta
    // semana puntual, no se duplica en Fijos.
    const yaCubiertoPorEspecial = new Set(opcionesDelDia.map((s) => s.plato_id));

    const fijosGlobalesDelDia = fijosGlobales
      .filter((p) => (p.disponibilidad === 'siempre') || (p.disponibilidad === 'fijo_dia' && p.dia_fijo === dia))
      .filter((p) => !yaCubiertoPorEspecial.has(p.id))
      .map((p) => ({
        origen: 'global',
        categoria: p.disponibilidad,
        plato_id: p.id,
        plato_nombre: p.nombre,
        vianda_activa: Boolean(fijosViandaMap[p.id]),
        vianda_id: fijosViandaMap[p.id]?.vianda_id ?? null,
        nombre_vianda: fijosViandaMap[p.id]?.nombre_vianda ?? null,
        guarnicion_id: fijosViandaMap[p.id]?.guarnicion_id ?? null,
        salsa_id: fijosViandaMap[p.id]?.salsa_id ?? null,
        salsa_libre: fijosViandaMap[p.id]?.salsa_libre ?? false,
        // Puesto en el menu = disponible por kilo por defecto; la tabla de
        // excepciones (menu_semanal_fijos_kilo) es la exclusion puntual de
        // esta semana (decision de sesion 2026-07-13, mismo criterio que
        // los especiales via menu_semanal_dias.disponible_por_kilo).
        disponible_por_kilo: !fijosSinKiloSet.has(p.id),
        visible_empresa_ids: fijosVisibilidadMap[p.id] ?? [],
      }));

    const fijosRotativosDelDia = rotativosPorDia[dia].map((r) => ({
      origen: 'rotativo',
      ciclo_id: r.ciclo.id,
      ciclo_nombre: r.ciclo.nombre,
      grupo_id: r.grupo?.id ?? null,
      grupo_nombre: r.grupo?.nombre ?? null,
      plato_id: r.plato?.plato_id ?? null,
      plato_nombre: r.plato?.plato_nombre ?? null,
      forzado: r.forzado,
      // sin_vianda_activa sigue siendo una senal de catalogo ("este plato no
      // tiene NINGUNA vianda configurada, ni siquiera para elegir") --
      // distinta de vianda_activa (decision de esta semana en particular).
      sin_vianda_activa: r.sinViandaActiva,
      vianda_activa: r.plato ? Boolean(fijosViandaMap[r.plato.plato_id]) : false,
      vianda_id: r.plato ? (fijosViandaMap[r.plato.plato_id]?.vianda_id ?? null) : null,
      nombre_vianda: r.plato ? (fijosViandaMap[r.plato.plato_id]?.nombre_vianda ?? null) : null,
      guarnicion_id: r.plato ? (fijosViandaMap[r.plato.plato_id]?.guarnicion_id ?? null) : null,
      salsa_id: r.plato ? (fijosViandaMap[r.plato.plato_id]?.salsa_id ?? null) : null,
      salsa_libre: r.plato ? (fijosViandaMap[r.plato.plato_id]?.salsa_libre ?? false) : false,
      disponible_por_kilo: r.plato ? !fijosSinKiloSet.has(r.plato.plato_id) : false,
      visible_empresa_ids: r.plato ? (fijosVisibilidadMap[r.plato.plato_id] ?? []) : [],
    }));

    return {
      dia,
      fecha: fechaDia,
      sin_servicio: Object.prototype.hasOwnProperty.call(sinServicioMap, dia),
      motivo_sin_servicio: sinServicioMap[dia] ?? null,
      opciones: opcionesDelDia.map((s) => ({
        slot_id: s.slot_id,
        opcion: s.opcion,
        plato_id: s.plato_id,
        plato_nombre: s.plato_nombre,
        vianda_id: s.vianda_id,
        nombre_vianda: s.nombre_vianda,
        guarnicion_id: s.guarnicion_id,
        salsa_id: s.salsa_id,
        salsa_libre: s.salsa_libre,
        vianda_activa: Boolean(s.vianda_id),
        // Puesto en el menu = disponible por kilo por defecto; el flag del
        // slot es una excepcion puntual para sacarlo esta semana (decision
        // de sesion 2026-07-13, revierte el requisito de regla de catalogo).
        disponible_por_kilo: s.disponible_por_kilo,
        empresas: s.empresas,
        // Allowlist real (menu_empresa_visibilidad) -- distinta de `empresas`
        // arriba, que es la asignacion Opcion A/B/C organizativa sin
        // enforcement. [] = visible para todas.
        visible_empresa_ids: s.visible_empresa_ids ?? [],
      })),
      fijos: [...fijosGlobalesDelDia, ...fijosRotativosDelDia],
    };
  });

  const categorias = await construirCategorias(menuSemanalId, dias, guarnicionesSemana, salsasSemana);

  return {
    semana: {
      id: menu.id,
      nombre: menu.nombre,
      fecha_inicio: menu.fecha_inicio,
      fecha_fin: menu.fecha_fin,
      estado: menu.estado,
    },
    dias,
    guarniciones: guarnicionesSemana,
    salsas: salsasSemana,
    categorias,
  };
};

export const setExcepcionEmpresaOpcion = async (menuSemanalId, empresaId, opcion) => {
  const menu = await repo.findMenu(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  const slots = await repo.findSlotsConEmpresas(menuSemanalId);
  const opcionesReales = new Set(slots.map((s) => s.opcion));
  if (!opcionesReales.has(opcion)) {
    throw ApiError.badRequest(`La opción "${opcion}" no existe en el menú de esta semana`);
  }

  return repo.upsertExcepcionEmpresaOpcion(menuSemanalId, empresaId, opcion);
};

export const quitarExcepcionEmpresaOpcion = (menuSemanalId, empresaId) =>
  repo.deleteExcepcionEmpresaOpcion(menuSemanalId, empresaId);

export const setDisponiblePorKilo = async (slotId, disponible) => {
  const actualizado = await repo.setDisponiblePorKilo(slotId, disponible);
  if (!actualizado) throw ApiError.notFound(`Slot con id ${slotId} no encontrado`);
};

// ── Vianda de fijos (decision por semana, no de catalogo) ───────────────

export const marcarFijoVianda = async (menuSemanalId, platoId) => {
  const menu = await repo.findMenu(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  // Usa la vianda "general" del plato (sin empresa especifica) -- si no
  // existe, no hay nada que anclar: el catalogo primero, la decision semanal
  // despues. El trigger de armado de vianda (Fase 1) ya evita duplicados por
  // plato+empresa, asi que esta es siempre la unica vianda general activa.
  const vianda = await viandasRepository.findGeneralActivaParaPlato(platoId);
  if (!vianda) {
    throw ApiError.badRequest('Este plato no tiene una vianda activa en el catálogo. Creala primero en Viandas.');
  }

  return repo.marcarFijoVianda(menuSemanalId, platoId, vianda.id);
};

export const quitarFijoVianda = (menuSemanalId, platoId) =>
  repo.quitarFijoVianda(menuSemanalId, platoId);

// ── Vianda de especiales (ancla por slot, mismo mecanismo que ya usaba el
// schema de Fase 1 pero que ningun endpoint vivo llegaba a setear) ───────

export const marcarSlotVianda = async (slotId) => {
  const platoId = await repo.findSlotPlatoId(slotId);
  if (!platoId) throw ApiError.notFound(`Slot con id ${slotId} no encontrado`);

  const vianda = await viandasRepository.findGeneralActivaParaPlato(platoId);
  if (!vianda) {
    throw ApiError.badRequest('Este plato no tiene una vianda activa en el catálogo. Creala primero en Viandas.');
  }

  return repo.setSlotVianda(slotId, vianda.id);
};

export const quitarSlotVianda = async (slotId) => {
  const actualizado = await repo.setSlotVianda(slotId, null);
  if (!actualizado) throw ApiError.notFound(`Slot con id ${slotId} no encontrado`);
};

// ── Venta por kilo de fijos (excepcion por semana) ───────────────────────

export const setFijoDisponiblePorKilo = async (menuSemanalId, platoId, disponible) => {
  const menu = await repo.findMenu(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  if (disponible) {
    await repo.quitarFijoSinKilo(menuSemanalId, platoId);
  } else {
    await repo.marcarFijoSinKilo(menuSemanalId, platoId);
  }
};

// ── Visibilidad de empresas de fijos (por semana) ────────────────────────

export const setEmpresasFijo = async (menuSemanalId, platoId, empresaIds) => {
  const menu = await repo.findMenu(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);

  await repo.setEmpresasFijo(menuSemanalId, platoId, empresaIds);
};

// ── Guarniciones y salsas sueltas de la semana ───────────────────────────

export const agregarGuarnicionSemana = async (menuSemanalId, guarnicionId) => {
  const menu = await repo.findMenu(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);
  await repo.agregarGuarnicionSemana(menuSemanalId, guarnicionId);
};

export const quitarGuarnicionSemana = (menuSemanalId, guarnicionId) =>
  repo.quitarGuarnicionSemana(menuSemanalId, guarnicionId);

export const agregarSalsaSemana = async (menuSemanalId, salsaId) => {
  const menu = await repo.findMenu(menuSemanalId);
  if (!menu) throw ApiError.notFound(`Menú semanal con id ${menuSemanalId} no encontrado`);
  await repo.agregarSalsaSemana(menuSemanalId, salsaId);
};

export const quitarSalsaSemana = (menuSemanalId, salsaId) =>
  repo.quitarSalsaSemana(menuSemanalId, salsaId);
