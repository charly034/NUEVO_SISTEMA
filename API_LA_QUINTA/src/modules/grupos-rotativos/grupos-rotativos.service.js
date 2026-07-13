import * as repo from './grupos-rotativos.repository.js';
import * as viandasRepository from '../viandas/viandas.repository.js';
import { lunesDe } from '../cocina/cocina.repository.js';
import { ApiError } from '../../utils/ApiError.js';

// Algoritmo de rotacion: determinista, funcion pura sobre datos ya
// cargados (facil de testear sin tocar la base). El indice soporta
// fechaInicioSemana anterior al ancla (modulo con normalizacion positiva).
// Acepta tanto 'YYYY-MM-DD' (ISO date-only ya se parsea como UTC) como un
// objeto Date (lo que devuelve pg para columnas DATE) -- new Date(x) maneja
// ambos casos correctamente sin interpolacion de template string, que daba
// NaN silencioso cuando el llamador pasaba un Date (bug real encontrado en
// verificacion manual).
export function calcularIndiceRotacion(fechaAncla, fechaInicioSemana, cantidadGrupos) {
  if (cantidadGrupos <= 0) return null;
  const msPorDia = 24 * 60 * 60 * 1000;
  const dias = Math.floor((new Date(fechaInicioSemana) - new Date(fechaAncla)) / msPorDia);
  const semanas = Math.floor(dias / 7);
  return ((semanas % cantidadGrupos) + cantidadGrupos) % cantidadGrupos;
}

// Resuelve que grupo_rotativo corresponde a un ciclo para una semana dada,
// sin escritura -- se puede llamar en cada lectura, no requiere filas por
// semana salvo que se fuerce una excepcion (ver resolverCicloParaSemana).
export async function resolverGrupoActivo(cicloRotacionId, fechaInicioSemana) {
  const grupos = await repo.findGruposPorCiclo(cicloRotacionId, { soloActivos: true });
  if (grupos.length === 0) return null;
  const config = await repo.findRotacionConfig();
  if (!config) return null;
  const indice = calcularIndiceRotacion(config.fecha_ancla, fechaInicioSemana, grupos.length);
  return grupos[indice];
}

// Resuelve el plato final para un ciclo, una semana puntual: excepcion
// manual (grupo y/o plato forzado) gana sobre el calculo automatico;
// dentro del grupo resuelto, el plato de orden=0 es el default salvo que
// la excepcion especifique uno distinto.
export async function resolverCicloParaSemana(ciclo, menuSemanalId, fechaInicioSemana) {
  const excepcion = await repo.findSeleccionSemana(menuSemanalId, ciclo.id);

  let grupo;
  if (excepcion) {
    grupo = await repo.findGrupoById(excepcion.grupo_rotativo_id);
  } else {
    grupo = await resolverGrupoActivo(ciclo.id, fechaInicioSemana);
  }

  if (!grupo) {
    return { ciclo, grupo: null, plato: null, forzado: Boolean(excepcion), sinViandaActiva: false };
  }

  const platos = await repo.findPlatosDeGrupo(grupo.id);
  let plato = null;
  if (excepcion?.plato_id) {
    plato = platos.find((p) => p.plato_id === excepcion.plato_id) || null;
  }
  if (!plato) {
    plato = platos.find((p) => p.orden === 0) || platos[0] || null;
  }

  const sinViandaActiva = plato ? !(await viandasRepository.existsActivaParaPlato(plato.plato_id)) : false;

  return { ciclo, grupo, plato, forzado: Boolean(excepcion), sinViandaActiva };
}

// ── Ciclos ────────────────────────────────────────────────────────────

export const listarCiclos = (filtros) => repo.findCiclos(filtros);

// Detalle completo de un ciclo para el drawer de administracion: sus grupos
// (ordenados) y, para cada uno, sus platos (ordenados, orden=0 es el default).
export const obtenerCicloConDetalle = async (id) => {
  const ciclo = await repo.findCicloById(id);
  if (!ciclo) throw ApiError.notFound(`Ciclo de rotacion con id ${id} no encontrado`);
  const grupos = await repo.findGruposPorCiclo(id);
  const gruposConPlatos = await Promise.all(
    grupos.map(async (grupo) => ({ ...grupo, platos: await repo.findPlatosDeGrupo(grupo.id) }))
  );
  return { ...ciclo, grupos: gruposConPlatos };
};

export const crearCiclo = async ({ dia_semana, nombre }) => {
  // El ancla de rotacion se fija sola con el primer ciclo que se crea en
  // todo el sistema y despues queda de solo lectura (decision de
  // /plan-eng-review: editarla retroactivamente afecta a TODOS los ciclos).
  await repo.crearRotacionConfigSiNoExiste(lunesDe(new Date().toISOString().slice(0, 10)));
  return repo.createCiclo({ dia_semana, nombre });
};

export const actualizarCiclo = async (id, fields) => {
  const ciclo = await repo.findCicloById(id);
  if (!ciclo) throw ApiError.notFound(`Ciclo de rotacion con id ${id} no encontrado`);
  return repo.updateCiclo(id, fields);
};

// ── Grupos ────────────────────────────────────────────────────────────

export const crearGrupo = async ({ ciclo_rotacion_id, nombre, orden }) => {
  const ciclo = await repo.findCicloById(ciclo_rotacion_id);
  if (!ciclo) throw ApiError.notFound(`Ciclo de rotacion con id ${ciclo_rotacion_id} no encontrado`);
  return repo.createGrupo({ ciclo_rotacion_id, nombre, orden });
};

export const actualizarGrupo = async (id, fields) => {
  const grupo = await repo.findGrupoById(id);
  if (!grupo) throw ApiError.notFound(`Grupo rotativo con id ${id} no encontrado`);
  return repo.updateGrupo(id, fields);
};

export const agregarPlatoAGrupo = async (grupoId, platoId, orden) => {
  const grupo = await repo.findGrupoById(grupoId);
  if (!grupo) throw ApiError.notFound(`Grupo rotativo con id ${grupoId} no encontrado`);
  return repo.agregarPlatoAGrupo(grupoId, platoId, orden);
};

export const quitarPlatoDeGrupo = async (grupoId, platoId) => {
  const grupo = await repo.findGrupoById(grupoId);
  if (!grupo) throw ApiError.notFound(`Grupo rotativo con id ${grupoId} no encontrado`);
  return repo.quitarPlatoDeGrupo(grupoId, platoId);
};

// ── Excepcion semanal ─────────────────────────────────────────────────

export const forzarSeleccionSemana = async ({ menu_semanal_id, ciclo_rotacion_id, grupo_rotativo_id, plato_id }) => {
  const ciclo = await repo.findCicloById(ciclo_rotacion_id);
  if (!ciclo) throw ApiError.notFound(`Ciclo de rotacion con id ${ciclo_rotacion_id} no encontrado`);
  const grupo = await repo.findGrupoById(grupo_rotativo_id);
  if (!grupo || grupo.ciclo_rotacion_id !== ciclo_rotacion_id) {
    throw ApiError.badRequest('El grupo indicado no pertenece a este ciclo de rotacion');
  }
  if (plato_id) {
    const platos = await repo.findPlatosDeGrupo(grupo_rotativo_id);
    if (!platos.some((p) => p.plato_id === plato_id)) {
      throw ApiError.badRequest('El plato indicado no pertenece a este grupo rotativo');
    }
  }
  return repo.upsertSeleccionSemana({ menu_semanal_id, ciclo_rotacion_id, grupo_rotativo_id, plato_id });
};

export const quitarSeleccionSemana = (menuSemanalId, cicloRotacionId) =>
  repo.deleteSeleccionSemana(menuSemanalId, cicloRotacionId);

// ── Vista agregada: ciclos de un dia + grupo/plato resuelto esta semana ──

export const listarCiclosConEstadoDelDia = async (diaSemana, menuSemanalId, fechaInicioSemana) => {
  const ciclos = await repo.findCiclos({ dia_semana: diaSemana, activo: true });
  return Promise.all(
    ciclos.map((ciclo) => resolverCicloParaSemana(ciclo, menuSemanalId, fechaInicioSemana))
  );
};
