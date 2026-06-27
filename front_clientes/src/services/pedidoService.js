import {
  adaptarSemanasPedido,
} from "../components/pedido/adaptadoresPedido.js";
import { apiGet, apiPatch, apiPost, apiPut } from "./apiCliente.js";
import { guarnicionesApi, menuApi, pedidoApi } from "./api.js";

async function obtenerSemanasPedidoMock({ empresaId, usuarioId } = {}) {
  const params = new URLSearchParams({ empresaId, usuarioId });
  return apiGet(`/pedidos/semanas?${params.toString()}`);
}

export async function obtenerSemanasPedido({
  empleado,
  empresaId,
  fechaReferencia,
  usuarioId,
} = {}) {
  try {
    const [menuData, historial, guarniciones] = await Promise.all([
      menuApi.activo(),
      pedidoApi.miHistorial(),
      guarnicionesApi.listar(),
    ]);

    return adaptarSemanasPedido({
      empleado,
      fechaReferencia,
      guarniciones,
      historial,
      menuData,
    });
  } catch (error) {
    console.warn(
      "No se pudo cargar pedidos desde API real. Usando mock temporal.",
      error,
    );
    return obtenerSemanasPedidoMock({ empresaId, usuarioId });
  }
}

export function obtenerPedidoPorSemana({ empresaId, usuarioId, semanaId }) {
  const params = new URLSearchParams({ empresaId, usuarioId, semanaId });
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
  const params = new URLSearchParams({ empresaId, usuarioId });
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
