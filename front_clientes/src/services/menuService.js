import { apiGet } from "./apiCliente.js";

export function obtenerOpcionesMenuPorDia({ empresaId, semanaId, diaId }) {
  const params = new URLSearchParams({ empresaId, semanaId, diaId });
  return apiGet(`/menu/opciones-dia?${params.toString()}`);
}

export function obtenerOpcionesMenuPorSemana({ empresaId, semanaId }) {
  const params = new URLSearchParams({ empresaId, semanaId });
  return apiGet(`/menu/opciones-semana?${params.toString()}`);
}

export function obtenerGuarnicionesPorPlato({ platoId }) {
  const params = new URLSearchParams({ platoId });
  return apiGet(`/menu/guarniciones?${params.toString()}`);
}

export const menuService = {
  obtenerGuarnicionesPorPlato,
  obtenerOpcionesMenuPorDia,
  obtenerOpcionesMenuPorSemana,
};
