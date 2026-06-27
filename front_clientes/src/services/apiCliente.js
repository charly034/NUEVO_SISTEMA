import { opcionesMenuPorDia } from "../data/opcionesMenuMock.js";
import { pedidoMock } from "../data/pedidoMock.js";
import { semanasMock } from "../data/semanasMock.js";

const demoraMockMs = 120;

function clonarDato(dato) {
  return JSON.parse(JSON.stringify(dato));
}

function responderMock(dato) {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => resolve(clonarDato(dato)), demoraMockMs);
  });
}

function extraerParametro(recurso, nombre) {
  const url = new URL(recurso, "http://api-mock.local");
  return url.searchParams.get(nombre);
}

function obtenerTodasLasOpciones() {
  return Object.values(opcionesMenuPorDia).flat();
}

function resolverGetMock(recurso) {
  if (recurso.startsWith("/pedidos/semanas")) return semanasMock;
  if (recurso.startsWith("/pedidos/historial")) return [pedidoMock];

  if (recurso.startsWith("/pedidos/por-semana")) {
    const semanaId = extraerParametro(recurso, "semanaId");
    return semanaId === pedidoMock.semanaId ? pedidoMock : null;
  }

  if (recurso.startsWith("/menu/opciones-dia")) {
    const diaId = extraerParametro(recurso, "diaId");
    return opcionesMenuPorDia[diaId] || opcionesMenuPorDia.lunes;
  }

  if (recurso.startsWith("/menu/opciones-semana")) return opcionesMenuPorDia;

  if (recurso.startsWith("/menu/guarniciones")) {
    const platoId = extraerParametro(recurso, "platoId");
    const plato = obtenerTodasLasOpciones().find((opcion) => opcion.id === platoId);
    return plato?.guarniciones || [];
  }

  return null;
}

export function apiGet(recurso) {
  // Reemplazar por fetch/axios: return api.get(recurso).then((r) => r.data)
  return responderMock(resolverGetMock(recurso));
}

export function apiPost(recurso, payload) {
  // Reemplazar por fetch/axios: return api.post(recurso, payload).then((r) => r.data)
  return responderMock({
    ...payload,
    id: payload.id || `${recurso.replaceAll("/", "-").replace(/^-/, "")}-${Date.now()}`,
    creadoEn: new Date().toISOString(),
  });
}

export function apiPut(recurso, payload) {
  // Reemplazar por fetch/axios: return api.put(recurso, payload).then((r) => r.data)
  return responderMock({
    ...payload,
    actualizadoEn: new Date().toISOString(),
  });
}

export function apiPatch(recurso, payload) {
  // Reemplazar por fetch/axios: return api.patch(recurso, payload).then((r) => r.data)
  return responderMock({
    ...payload,
    actualizadoEn: new Date().toISOString(),
  });
}
