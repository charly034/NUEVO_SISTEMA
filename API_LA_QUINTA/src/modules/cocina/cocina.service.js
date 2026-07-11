import * as repo from './cocina.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import * as menuRepo from '../menus-semanales/menus-semanales.repository.js';
import * as platosRepo from '../platos/platos.repository.js';

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];

// Normaliza fecha_inicio (Date o string) a 'YYYY-MM-DD' para pasarla a repo.lunesDe
function normalizarFechaInicioISO(fechaInicio) {
  return fechaInicio.toISOString ? fechaInicio.toISOString().slice(0, 10) : String(fechaInicio).slice(0, 10);
}

// Suma dias a una fecha ISO (YYYY-MM-DD) y devuelve otra fecha ISO
function addDiasISO(fechaISO, dias) {
  const fecha = new Date(`${fechaISO}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

// Checklist del Local para una fecha: platos programados ese dia (diario/dia_semana/fecha puntual),
// sin cantidades. El Local no genera pedidos ni ventas en este sistema (ver docs/ai/90-redesign-dominio-borrador.md).
function getChecklistLocal(fechaISO) {
  return platosRepo.findParaFecha(fechaISO);
}

// Resumen de menu_semanal usado en todas las respuestas de este módulo
function serializeMenu(menu) {
  return { id: menu.id, nombre: menu.nombre, fecha_inicio: menu.fecha_inicio, fecha_fin: menu.fecha_fin, estado: menu.estado };
}

// Platos 'siempre disponibles' del catálogo, y los 'fijo_dia' que corresponden a un día
function filtrarSiempre(catalogoFijosYSiempre) {
  return catalogoFijosYSiempre.filter((p) => p.disponibilidad === 'siempre');
}
function filtrarFijosDelDia(catalogoFijosYSiempre, dia) {
  return catalogoFijosYSiempre.filter((p) => p.disponibilidad === 'fijo_dia' && p.dia_fijo === dia);
}

// Agrupa conteos por plato_id, añade breakdown por empresa
function agruparConteos(filas) {
  const map = {};
  for (const f of filas) {
    if (!map[f.plato_id]) {
      map[f.plato_id] = {
        plato_id:     f.plato_id,
        plato_nombre: f.plato_nombre,
        total:        0,
        empresas:     [],
      };
    }
    map[f.plato_id].total += f.total;
    map[f.plato_id].empresas.push({ empresa_id: f.empresa_id, empresa_nombre: f.empresa_nombre, total: f.total });
  }
  return Object.values(map);
}

// ── Vista de hoy ──────────────────────────────────────────────────

export const getCocinaHoy = async (fechaISO) => {
  const menu = await repo.findMenuActivoPorFecha(fechaISO);
  const dia  = repo.diaDeNombre(fechaISO);
  const lunes = repo.lunesDe(fechaISO);

  const [catalogoFijosYSiempre, sinServicio] = await Promise.all([
    repo.findFijosYSiempre(),
    menu ? repo.findSinServicio(menu.id) : Promise.resolve({}),
  ]);

  const fijosDelDia  = filtrarFijosDelDia(catalogoFijosYSiempre, dia);
  const siempre      = filtrarSiempre(catalogoFijosYSiempre);
  const checklistLocal = await getChecklistLocal(fechaISO);

  if (!menu) {
    return {
      fecha: fechaISO,
      dia,
      menu: null,
      sin_servicio: false,
      slots:  [],
      conteos_vianda: [],
      fijos:   fijosDelDia,
      siempre,
      checklist_local: checklistLocal,
    };
  }

  const [slots, conteosRaw, kpis, totalesPorDia] = await Promise.all([
    repo.findSlotsPorDia(menu.id, dia),
    repo.findConteosPedidos(lunes, dia),
    repo.findKPIsHoy(lunes, dia),
    repo.findTotalesPorDia(lunes),
  ]);

  const conteosVianda = agruparConteos(conteosRaw);

  return {
    fecha: fechaISO,
    dia,
    menu: serializeMenu(menu),
    sin_servicio: dia in sinServicio,
    motivo_sin_servicio: sinServicio[dia] ?? null,
    slots,
    conteos_vianda: conteosVianda,
    kpis: {
      viandas_total:    Number(kpis.total),
      viandas_listas:   Number(kpis.listas),
      viandas_pendientes: Number(kpis.pendientes),
      empresas_count:   Number(kpis.empresas_count),
    },
    totales_por_dia: totalesPorDia,
    fijos:   fijosDelDia,
    siempre,
    checklist_local: checklistLocal,
  };
};

// ── Vista de semana ───────────────────────────────────────────────

export const getCocinaSemana = async (menuId) => {
  const menu = await menuRepo.findById(menuId);
  if (!menu) throw ApiError.notFound(`Menu semanal con id ${menuId} no encontrado`);

  const lunes = repo.lunesDe(normalizarFechaInicioISO(menu.fecha_inicio));

  const [slotsAll, conteosAll, catalogoFijosYSiempre, sinServicio] = await Promise.all([
    repo.findSlotsSemana(menu.id),
    repo.findConteosPedidos(lunes),
    repo.findFijosYSiempre(),
    repo.findSinServicio(menu.id),
  ]);

  const siempre = filtrarSiempre(catalogoFijosYSiempre);

  const dias = await Promise.all(DIAS.map(async (dia, indice) => {
    const slotsDelDia   = slotsAll.filter((s) => s.dia === dia);
    const conteosDelDia = agruparConteos(conteosAll.filter((c) => c.dia === dia));
    const fijosDelDia   = filtrarFijosDelDia(catalogoFijosYSiempre, dia);
    const checklistLocal = await getChecklistLocal(addDiasISO(lunes, indice));

    return {
      dia,
      sin_servicio: dia in sinServicio,
      motivo_sin_servicio: sinServicio[dia] ?? null,
      slots:          slotsDelDia,
      conteos_vianda: conteosDelDia,
      fijos:          fijosDelDia,
      checklist_local: checklistLocal,
    };
  }));

  return {
    menu: serializeMenu(menu),
    dias,
    siempre,
  };
};

// ── Oferta semanal ────────────────────────────────────────────────

export const getOfertaSemanal = async (menuId) => {
  const menu = await menuRepo.findById(menuId);
  if (!menu) throw ApiError.notFound(`Menu semanal con id ${menuId} no encontrado`);

  const [slots, catalogoFijosYSiempre, sinServicio] = await Promise.all([
    repo.findOfertaSemanal(menu.id),
    repo.findFijosYSiempre(),
    repo.findSinServicio(menu.id),
  ]);

  const siempre = filtrarSiempre(catalogoFijosYSiempre);

  const diasMap = {};
  for (const slot of slots) {
    if (!diasMap[slot.dia]) diasMap[slot.dia] = [];
    diasMap[slot.dia].push({
      ...slot,
      empresa_ids:    slot.empresa_ids ?? [],
      empresa_nombres: slot.empresa_nombres ?? [],
      todas_empresas: (slot.empresa_ids ?? []).length === 0,
    });
  }

  const dias = DIAS.map((dia) => ({
    dia,
    sin_servicio: dia in sinServicio,
    motivo_sin_servicio: sinServicio[dia] ?? null,
    slots: diasMap[dia] ?? [],
    fijos: filtrarFijosDelDia(catalogoFijosYSiempre, dia),
  }));

  return {
    menu: serializeMenu(menu),
    dias,
    siempre,
  };
};

// ── Etiquetas ─────────────────────────────────────────────────────

export const getEtiquetas = async (menuId, dia) => {
  const menu = await menuRepo.findById(menuId);
  if (!menu) throw ApiError.notFound(`Menu semanal con id ${menuId} no encontrado`);

  const lunes = repo.lunesDe(normalizarFechaInicioISO(menu.fecha_inicio));

  const etiquetas = await repo.findDetalleEtiquetas(lunes, dia);

  return {
    menu:  { id: menu.id, nombre: menu.nombre, fecha_inicio: menu.fecha_inicio },
    dia,
    etiquetas,
  };
};
