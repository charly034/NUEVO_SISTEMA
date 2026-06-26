import { opcionSinPedido } from "../data/opcionesMenuMock.js";

export function platoRequiereGuarnicion(plato) {
  return Boolean(plato?.requiereGuarnicion);
}

export function seleccionDiaEsValida(seleccion) {
  if (!seleccion?.plato) return false;
  if (seleccion.plato.id === opcionSinPedido.id) return true;
  if (!platoRequiereGuarnicion(seleccion.plato)) return true;
  return Boolean(seleccion.guarnicion);
}

export function construirTextoPlatoSeleccionado(seleccion) {
  if (!seleccion?.plato) return "Sin seleccionar";
  if (seleccion.plato.id === opcionSinPedido.id) return "Sin pedido";
  if (seleccion.guarnicion) {
    const nombreGuarnicion =
      typeof seleccion.guarnicion === "string"
        ? seleccion.guarnicion
        : seleccion.guarnicion.nombre;
    return `${seleccion.plato.nombre} con ${String(nombreGuarnicion).toLowerCase()}`;
  }
  return seleccion.plato.nombre;
}

export function crearSeleccionDesdeTexto(plato, opciones = []) {
  const opcion = opciones.find((item) => item.nombre === plato);
  if (opcion) return { plato: opcion, guarnicion: "" };
  if (plato === "Sin pedido") return { plato: opcionSinPedido, guarnicion: "" };
  return null;
}

export function contarSeleccionesValidas(dias) {
  return dias.filter(
    (dia) =>
      dia.plato &&
      !["Sin pedido", "Sin seleccionar"].includes(dia.plato),
  ).length;
}
