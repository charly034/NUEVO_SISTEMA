import { apiGet } from "./apiCliente.js";
import { crearIdDesdeTexto } from "../utils/texto.js";

function crearParams(limpiar) {
  return new URLSearchParams(
    Object.entries(limpiar).filter(([, valor]) => valor !== undefined && valor !== null),
  );
}

function normalizarGuarnicion(guarnicion) {
  if (!guarnicion) return null;
  if (typeof guarnicion === "string") return { id: crearIdDesdeTexto(guarnicion), nombre: guarnicion };

  return {
    id: guarnicion.id ?? guarnicion.guarnicionId ?? guarnicion.guarnicion_id ?? crearIdDesdeTexto(guarnicion.nombre),
    nombre: guarnicion.nombre ?? guarnicion.nombreGuarnicion ?? guarnicion.guarnicion_nombre ?? String(guarnicion.id || ""),
  };
}

function normalizarPlato(plato) {
  if (!plato) return null;
  const requiereGuarnicion = Boolean(
    plato.requiereGuarnicion ??
      plato.requiere_guarnicion ??
      plato.tieneGuarnicion ??
      plato.tiene_guarnicion,
  );
  const id = plato.id ?? plato.platoId ?? plato.plato_id ?? crearIdDesdeTexto(plato.nombre ?? plato.plato_nombre);

  return {
    id,
    platoId: plato.platoId ?? plato.plato_id ?? id,
    opcion: plato.opcion ?? null,
    nombre: plato.nombre ?? plato.plato_nombre ?? "Plato sin nombre",
    descripcion: plato.descripcion ?? plato.detalle ?? "Menu publicado",
    categoria: plato.categoria ?? "menu",
    tipo: plato.tipo ?? (requiereGuarnicion ? "principal_con_guarnicion" : "plato_completo"),
    requiereGuarnicion,
    destacado: Boolean(plato.destacado ?? plato.especial),
    grupo: plato.grupo ?? (plato.destacado || plato.especial ? "especiales" : "fijos"),
    estado: plato.estado ?? (plato.disponible === false ? "deshabilitado" : "disponible"),
    diasDisponibles: plato.diasDisponibles ?? plato.dias_disponibles ?? null,
    etiquetas: Array.isArray(plato.etiquetas)
      ? plato.etiquetas
      : Array.isArray(plato.tags)
        ? plato.tags
        : [],
    guarniciones: (plato.guarniciones || [])
      .map(normalizarGuarnicion)
      .filter(Boolean),
  };
}

function obtenerDiaId(dia) {
  return dia.diaId ?? dia.id ?? dia.clave ?? dia.dia;
}

function normalizarOpcionesSemana(respuesta) {
  if (Array.isArray(respuesta)) return { dias: respuesta };
  if (Array.isArray(respuesta?.dias)) return respuesta;
  if (respuesta?.opcionesPorDia && typeof respuesta.opcionesPorDia === "object") {
    return {
      ...respuesta,
      dias: Object.entries(respuesta.opcionesPorDia).map(([diaId, opciones]) => ({
        diaId,
        opciones,
      })),
    };
  }
  if (respuesta && typeof respuesta === "object") {
    return {
      ...respuesta,
      dias: Object.entries(respuesta).map(([diaId, opciones]) => ({
        diaId,
        opciones,
      })),
    };
  }
  return { dias: [] };
}

export async function obtenerOpcionesMenuPorSemana({ empresaId, semanaId }) {
  const params = crearParams({ empresaId, semanaId });
  const respuesta = await apiGet(`/menu/semanas/${encodeURIComponent(semanaId)}/opciones?${params.toString()}`);
  const semana = normalizarOpcionesSemana(respuesta);

  return {
    ...semana,
    dias: (semana.dias || []).map((dia) => {
      const diaId = obtenerDiaId(dia);
      const especiales = (dia.especiales || [])
        .map((plato) => normalizarPlato({ ...plato, destacado: true, grupo: "especiales" }))
        .filter(Boolean);
      const fijos = (dia.fijos || [])
        .map((plato) => normalizarPlato({ ...plato, destacado: false, grupo: "fijos" }))
        .filter(Boolean)
        .filter((plato) => !plato.diasDisponibles || plato.diasDisponibles.includes(diaId));
      const opcionesLegacy = (dia.opciones || dia.platos || [])
        .map(normalizarPlato)
        .filter(Boolean);
      const opciones = [...especiales, ...fijos, ...opcionesLegacy]
        .filter((plato) => plato.estado !== "agotado" && plato.estado !== "deshabilitado");

      return {
        ...dia,
        diaId,
        especiales,
        fijos,
        opciones,
      };
    }),
  };
}

export async function obtenerOpcionesMenuPorDia({ empresaId, semanaId, diaId }) {
  const semana = await obtenerOpcionesMenuPorSemana({ empresaId, semanaId });
  const dia = (semana.dias || []).find(
    (item) => String(item.diaId).toLowerCase() === String(diaId).toLowerCase(),
  );

  return dia?.opciones || [];
}

export const menuService = {
  obtenerOpcionesMenuPorDia,
  obtenerOpcionesMenuPorSemana,
};
