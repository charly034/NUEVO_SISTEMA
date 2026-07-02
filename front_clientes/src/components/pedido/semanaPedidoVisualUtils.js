import { formatearFechaPedido } from "../../utils/fechasPedido.js";

export function formatearFechaDia(fecha) {
  if (!fecha) return "";
  const [anio, mes, dia] = String(fecha).split("T")[0].split("-").map(Number);
  if (!anio || !mes || !dia) return "";
  return formatearFechaPedido(new Date(anio, mes - 1, dia));
}

export function obtenerEstadoDiaMockup(dia, estadoVisual) {
  const sinSeleccion = !dia.plato || dia.plato === "Sin seleccionar";
  const esSinVianda =
    dia.plato === "Sin pedido" ||
    dia.plato === "Sin pedido por defecto" ||
    dia.seleccion?.sinPedido;
  const bloqueado = ["bloqueado", "feriado", "vencido"].includes(estadoVisual);

  if (bloqueado) {
    return {
      tono: "bloqueado",
      etiqueta: estadoVisual === "feriado" ? "FERIADO" : "NO DISPONIBLE",
      texto: dia.motivo || "No disponible",
    };
  }

  if (esSinVianda) {
    return {
      tono: "sinVianda",
      etiqueta: "SIN VIANDA",
      texto: "Sin vianda este dia",
    };
  }

  if (!sinSeleccion) {
    const nombreGuarnicion =
      dia.seleccion?.nombreGuarnicion ||
      (typeof dia.seleccion?.guarnicion === "string"
        ? dia.seleccion.guarnicion
        : dia.seleccion?.guarnicion?.nombre);

    return {
      tono: "seleccionado",
      etiqueta: "SELECCIONADO",
      texto: dia.plato,
      detalle: nombreGuarnicion ? `Guarnicion: ${nombreGuarnicion}` : "",
    };
  }

  return {
    tono: "pendiente",
    etiqueta: "Pendiente",
    texto: "Toca para elegir un plato",
  };
}
