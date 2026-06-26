import { opcionesMenuPorDia } from "../data/opcionesMenuMock.js";
import { pedidoMock } from "../data/pedidoMock.js";
import { semanasMock } from "../data/semanasMock.js";

const demoraMockMs = 120;

function clonarDato(dato) {
  return JSON.parse(JSON.stringify(dato));
}

function simularRespuestaApi(dato, { demora = demoraMockMs } = {}) {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      resolve(clonarDato(dato));
    }, demora);
  });
}

function crearRespuestaPedido(payload, extras = {}) {
  return {
    ...pedidoMock,
    id: extras.id || pedidoMock.id,
    estado: "confirmado",
    ...payload,
    actualizadoEn: new Date().toISOString(),
  };
}

export async function obtenerSemanasPedido() {
  return simularRespuestaApi(semanasMock);
}

export async function obtenerOpcionesMenuPorDia(diaId) {
  return simularRespuestaApi(opcionesMenuPorDia[diaId] || opcionesMenuPorDia.lunes);
}

export async function crearPedido(payload) {
  return simularRespuestaApi(
    crearRespuestaPedido(payload, {
      id: `pedido-mock-${payload.semanaId}`,
    }),
  );
}

export async function actualizarPedido(pedidoId, payload) {
  return simularRespuestaApi(
    crearRespuestaPedido(payload, {
      id: pedidoId || `pedido-mock-${payload.semanaId}`,
    }),
  );
}

export async function confirmarPedido(pedidoId) {
  return simularRespuestaApi({
    ...pedidoMock,
    id: pedidoId || pedidoMock.id,
    estado: "confirmado",
    confirmadoEn: new Date().toISOString(),
  });
}

export async function obtenerPedidoPorSemana(semanaId) {
  if (semanaId !== pedidoMock.semanaId) return null;
  return simularRespuestaApi(pedidoMock);
}

export const pedidoService = {
  actualizarPedido,
  confirmarPedido,
  crearPedido,
  obtenerOpcionesMenuPorDia,
  obtenerPedidoPorSemana,
  obtenerSemanasPedido,
};
