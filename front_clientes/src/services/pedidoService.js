import {
  adaptarSemanasPedido,
} from "../components/pedido/adaptadoresPedido.js";
import { apiGet, apiPatch, apiPost, apiPut } from "./apiCliente.js";

function crearParams(limpiar) {
  return new URLSearchParams(
    Object.entries(limpiar).filter(([, valor]) => valor !== undefined && valor !== null),
  );
}

export async function obtenerSemanasPedido({
  empleado,
  empresaId,
  fechaReferencia,
} = {}) {
  const params = crearParams({ empresaId });

  if (import.meta.env.VITE_USAR_ENDPOINT_LEGACY_PEDIDOS === "true") {
    const [menuData, historial, guarniciones] = await Promise.all([
      apiGet("/pedidos/menu-activo"),
      apiGet("/pedidos/mi-historial"),
      apiGet("/guarniciones?activo=true"),
    ]);

    return adaptarSemanasPedido({
      empleado,
      fechaReferencia,
      guarniciones,
      historial,
      menuData,
    });
  }

  const query = params.toString();
  const respuesta = await apiGet(`/pedidos/semanas${query ? `?${query}` : ""}`, {
    requiereAuth: true,
  });
  return Array.isArray(respuesta) ? respuesta : respuesta?.semanas || [];
}

export function obtenerPedidoPorSemana({ empresaId, usuarioId, semanaId }) {
  const params = crearParams({ empresaId, usuarioId, semanaId });
  return apiGet(`/pedidos/por-semana?${params.toString()}`);
}

export function crearPedido(payload) {
  return apiPost("/pedidos", payload);
}

export function actualizarPedido(pedidoId, payload) {
  return apiPut(`/pedidos/${pedidoId || payload.pedidoId || payload.semanaId}`, payload);
}

export function confirmarPedido(pedidoId) {
  return apiPatch(`/pedidos/${pedidoId}/confirmar`, {
    estado: "confirmado",
  });
}

export function cancelarPedido(pedidoId) {
  return apiPatch(`/pedidos/${pedidoId}/cancelar`, {
    estado: "cancelado",
  });
}

export function obtenerHistorialPedidos({ empresaId, usuarioId } = {}) {
  const params = crearParams({ empresaId, usuarioId });
  return apiGet(`/pedidos/historial?${params.toString()}`);
}

export const pedidoService = {
  actualizarPedido,
  cancelarPedido,
  confirmarPedido,
  crearPedido,
  obtenerHistorialPedidos,
  obtenerPedidoPorSemana,
  obtenerSemanasPedido,
};
