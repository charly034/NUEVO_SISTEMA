import { opcionSinPedido } from "../data/opcionesMenuMock.js";

export function platoRequiereGuarnicion(plato) {
  return Boolean(plato?.requiereGuarnicion);
}

function obtenerNombreGuarnicion(guarnicion) {
  if (!guarnicion) return "";
  return typeof guarnicion === "string" ? guarnicion : guarnicion.nombre;
}

function obtenerIdGuarnicion(guarnicion) {
  if (!guarnicion || typeof guarnicion === "string") return null;
  return guarnicion.id || null;
}

function crearIdDesdeTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function crearSeleccionPedido(plato, guarnicion = "") {
  if (!plato) return null;
  const sinPedido = plato.id === opcionSinPedido.id;

  return {
    plato,
    guarnicion,
    platoId: sinPedido ? null : plato.platoId || plato.id,
    nombrePlato: sinPedido ? "" : plato.nombre,
    guarnicionId: sinPedido
      ? null
      : obtenerIdGuarnicion(guarnicion) || crearIdDesdeTexto(guarnicion),
    nombreGuarnicion: sinPedido ? "" : obtenerNombreGuarnicion(guarnicion),
    sinPedido,
  };
}

export function seleccionDiaEsValida(seleccion) {
  if (!seleccion?.plato) return false;
  if (seleccion.plato.id === opcionSinPedido.id || seleccion.sinPedido) return true;
  if (!platoRequiereGuarnicion(seleccion.plato)) return true;
  return Boolean(seleccion.guarnicion);
}

export function construirTextoPlatoSeleccionado(seleccion) {
  if (!seleccion?.plato) return "Sin seleccionar";
  if (seleccion.plato.id === opcionSinPedido.id || seleccion.sinPedido) return "Sin pedido";
  if (seleccion.guarnicion) {
    return `${seleccion.plato.nombre} con ${obtenerNombreGuarnicion(seleccion.guarnicion).toLowerCase()}`;
  }
  return seleccion.plato.nombre;
}

export function crearSeleccionDesdeTexto(plato, opciones = []) {
  const textoPlato = String(plato || "");
  const textoNormalizado = textoPlato.toLowerCase();

  if (textoPlato === "Sin pedido") {
    return crearSeleccionPedido(opcionSinPedido);
  }

  const opcion = opciones.find((item) => {
    const nombre = item.nombre.toLowerCase();
    return textoNormalizado === nombre || textoNormalizado.startsWith(nombre);
  });

  if (!opcion) return null;

  const guarnicion = (opcion.guarniciones || []).find((item) =>
    textoNormalizado.includes(obtenerNombreGuarnicion(item).toLowerCase()),
  ) || "";

  return crearSeleccionPedido(opcion, guarnicion);
}

export function contarSeleccionesValidas(dias) {
  return dias.filter((dia) => {
    if (dia.seleccion?.sinPedido) return false;
    if (dia.seleccion?.plato) return true;
    return dia.plato && !["Sin pedido", "Sin seleccionar"].includes(dia.plato);
  }).length;
}
