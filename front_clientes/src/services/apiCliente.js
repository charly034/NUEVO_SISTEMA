import { opcionesMenuPorDia } from "../data/opcionesMenuMock.js";
import { pedidoMock } from "../data/pedidoMock.js";
import { semanasMock } from "../data/semanasMock.js";
import { iniciarMedicionPerformance } from "../utils/performance.js";
import { clearClientSession, getClientToken } from "./api.js";

const API_URL = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
export const USAR_MOCKS = import.meta.env.VITE_USAR_MOCKS_PEDIDO === "true";
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
  if (/^\/menu\/semanas\/[^/]+\/opciones/.test(recurso)) return opcionesMenuPorDia;

  if (recurso.startsWith("/menu/guarniciones")) {
    const platoId = extraerParametro(recurso, "platoId");
    const plato = obtenerTodasLasOpciones().find((opcion) => opcion.id === platoId);
    return plato?.guarniciones || [];
  }

  return null;
}

function construirUrl(recurso) {
  if (/^https?:\/\//.test(recurso)) return recurso;
  return `${API_URL}${recurso.startsWith("/") ? recurso : `/${recurso}`}`;
}

function extraerMensajeError(data, status) {
  return (
    data?.message ||
    data?.mensaje ||
    data?.error ||
    `La API respondio con error ${status}.`
  );
}

function extraerData(data) {
  if (data && typeof data === "object" && "data" in data) return data.data;
  return data;
}

async function parsearRespuestaJson(response) {
  const texto = await response.text();
  if (!texto) return null;

  try {
    return JSON.parse(texto);
  } catch {
    throw new Error("La API devolvio una respuesta invalida.");
  }
}

function crearErrorAutenticacion(mensaje = "No pudimos cargar tu pedido. Inicia sesion nuevamente.") {
  const error = new Error(mensaje);
  error.status = 401;
  error.codigo = "sin_token";
  return error;
}

async function pedirApi(recurso, opciones = {}) {
  const { requiereAuth = false, ...opcionesFetch } = opciones;
  const metodo = opcionesFetch.method || "GET";
  const finalizarMedicion = iniciarMedicionPerformance("request:fetch", {
    metodo,
    recurso: recurso.split("?")[0],
  });
  const headers = {
    Accept: "application/json",
    ...(opcionesFetch.body ? { "Content-Type": "application/json" } : {}),
    ...(opcionesFetch.headers || {}),
  };
  const token = getClientToken();

  if (requiereAuth && !token) {
    throw crearErrorAutenticacion();
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(construirUrl(recurso), {
      ...opcionesFetch,
      headers,
    });
  } catch {
    finalizarMedicion({ estado: "error_red" });
    throw new Error("No pudimos conectar con la API. Revisa que el backend este levantado.");
  }

  const data = await parsearRespuestaJson(response);
  finalizarMedicion({ estado: response.ok ? "ok" : "error", status: response.status });

  if (!response.ok) {
    const error = new Error(extraerMensajeError(data, response.status));
    error.status = response.status;
    error.data = data;

    if (response.status === 401) {
      clearClientSession();
      window.dispatchEvent(new Event("cliente:unauthorized"));
    }

    throw error;
  }

  return extraerData(data);
}

export function apiGet(recurso, opciones = {}) {
  if (USAR_MOCKS) return responderMock(resolverGetMock(recurso));
  return pedirApi(recurso, { ...opciones, method: "GET" });
}

export function apiPost(recurso, payload, opciones = {}) {
  if (!USAR_MOCKS) {
    return pedirApi(recurso, {
      ...opciones,
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  return responderMock({
    ...payload,
    id: payload.id || `${recurso.replaceAll("/", "-").replace(/^-/, "")}-${Date.now()}`,
    creadoEn: new Date().toISOString(),
  });
}

export function apiPut(recurso, payload, opciones = {}) {
  if (!USAR_MOCKS) {
    return pedirApi(recurso, {
      ...opciones,
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  return responderMock({
    ...payload,
    actualizadoEn: new Date().toISOString(),
  });
}

export function apiPatch(recurso, payload, opciones = {}) {
  if (!USAR_MOCKS) {
    return pedirApi(recurso, {
      ...opciones,
      method: "PATCH",
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
    });
  }

  return responderMock({
    ...payload,
    actualizadoEn: new Date().toISOString(),
  });
}

export function apiDelete(recurso, opciones = {}) {
  if (USAR_MOCKS) return responderMock({ eliminado: true });
  return pedirApi(recurso, { ...opciones, method: "DELETE" });
}
