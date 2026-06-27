import {
  ORIGEN_SIN_PEDIDO_DEFAULT,
  ORIGEN_SIN_PEDIDO_USUARIO,
  SIN_PEDIDO_ID,
} from "../constants/estadosPedido.js";

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

export function crearOpcionSinPedido({ porDefecto = false } = {}) {
  return {
    id: SIN_PEDIDO_ID,
    nombre: "Sin pedido para este dia",
    descripcion: porDefecto
      ? "Preseleccionado para evitar pedidos de fin de semana por error"
      : "No recibir comida este dia",
    categoria: "sin_pedido",
    tipo: "sin_pedido",
    requiereGuarnicion: false,
    porDefecto,
    etiquetas: porDefecto ? ["Por defecto"] : [],
    guarniciones: [],
  };
}

export function crearSeleccionPedido(plato, guarnicion = "", opciones = {}) {
  if (!plato) return null;
  const sinPedido = plato.id === SIN_PEDIDO_ID;
  const origenSinPedido = opciones.origenSinPedido ||
    (plato.porDefecto ? ORIGEN_SIN_PEDIDO_DEFAULT : ORIGEN_SIN_PEDIDO_USUARIO);

  return {
    plato,
    guarnicion,
    platoId: sinPedido ? null : plato.platoId || plato.id,
    nombrePlato: sinPedido ? "" : plato.nombre,
    guarnicionId: sinPedido
      ? null
      : obtenerIdGuarnicion(guarnicion) || crearIdDesdeTexto(guarnicion),
    nombreGuarnicion: sinPedido ? "" : obtenerNombreGuarnicion(guarnicion),
    origenSinPedido: sinPedido ? origenSinPedido : null,
    sinPedido,
  };
}

export function seleccionDiaEsValida(seleccion) {
  if (!seleccion?.plato) return false;
  if (seleccion.plato.id === SIN_PEDIDO_ID || seleccion.sinPedido) return true;
  if (!platoRequiereGuarnicion(seleccion.plato)) return true;
  return Boolean(seleccion.guarnicion);
}

export function construirTextoPlatoSeleccionado(seleccion) {
  if (!seleccion?.plato) return "Sin seleccionar";
  if (seleccion.plato.id === SIN_PEDIDO_ID || seleccion.sinPedido) {
    return seleccion.origenSinPedido === ORIGEN_SIN_PEDIDO_DEFAULT
      ? "Sin pedido por defecto"
      : "Sin pedido";
  }
  if (seleccion.guarnicion) {
    return `${seleccion.plato.nombre} con ${obtenerNombreGuarnicion(seleccion.guarnicion).toLowerCase()}`;
  }
  return seleccion.plato.nombre;
}

export function crearSeleccionDesdeTexto(plato, opciones = []) {
  const textoPlato = String(plato || "");
  const textoNormalizado = textoPlato.toLowerCase();

  if (textoPlato === "Sin pedido" || textoPlato === "Sin pedido por defecto") {
    const porDefecto = textoPlato === "Sin pedido por defecto";
    return crearSeleccionPedido(
      crearOpcionSinPedido({ porDefecto }),
      "",
      {
        origenSinPedido: porDefecto
          ? ORIGEN_SIN_PEDIDO_DEFAULT
          : ORIGEN_SIN_PEDIDO_USUARIO,
      },
    );
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
    return dia.plato && !["Sin pedido", "Sin pedido por defecto", "Sin seleccionar"].includes(dia.plato);
  }).length;
}
