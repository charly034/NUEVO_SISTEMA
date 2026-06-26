import { formatearFechaPedido } from "./fechasPedido.js";

const indiceDia = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

function fechaDesdeISO(fechaISO) {
  const [anio, mes, dia] = String(fechaISO).split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function aplicarHora(fecha, hora = "09:30") {
  const [horas, minutos] = hora.split(":").map(Number);
  const resultado = new Date(fecha);
  resultado.setHours(horas || 0, minutos || 0, 0, 0);
  return resultado;
}

function obtenerFechaActual(semana, fechaActual) {
  return new Date(semana.fechaActualMock || fechaActual || Date.now());
}

function obtenerInicioSemana(semana) {
  const primerDia = semana.dias?.[0]?.fecha;
  return fechaDesdeISO(semana.fechaDesde || primerDia || semana.id);
}

function obtenerLimiteSemanal(semana) {
  const inicio = obtenerInicioSemana(semana);
  const diaLimite = semana.limiteModificacion?.dia || "lunes";
  const hora = semana.limiteModificacion?.hora || "09:30";
  const limite = new Date(inicio);
  limite.setDate(inicio.getDate() + ((indiceDia[diaLimite] ?? 1) - 1));
  return aplicarHora(limite, hora);
}

function obtenerLimiteDiario(dia, semana) {
  const hora = semana.limiteModificacion?.hora || "09:30";
  return aplicarHora(fechaDesdeISO(dia.fecha), hora);
}

function formatearFechaLimite(fecha) {
  return formatearFechaPedido(fecha, { incluirDiaSemana: true });
}

function formatearHora(fecha) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
}

function tieneSugerenciaEnviada(semana) {
  return (
    (semana.recomendacionesUsuario || []).length > 0 ||
    Boolean(semana.comentarioRecomendacion)
  );
}

export function obtenerReglaDia(dia, semana) {
  const tipoPlan = semana.tipoPlan || semana.modalidad || "semanal";
  if (tipoPlan === "mixto") return dia.regla || "diario";
  return tipoPlan;
}

export function puedeModificarDia(dia, semana, fechaActual) {
  if (dia.bloqueado || ["cerrado", "fuera_de_plazo"].includes(semana.estado)) {
    return false;
  }

  const ahora = obtenerFechaActual(semana, fechaActual);
  const regla = obtenerReglaDia(dia, semana);
  const limite =
    regla === "semanal"
      ? obtenerLimiteSemanal(semana)
      : obtenerLimiteDiario(dia, semana);

  return ahora <= limite;
}

export function puedeModificarSemana(semana, fechaActual) {
  if (["cerrado", "fuera_de_plazo"].includes(semana.estado)) return false;
  return (semana.dias || []).some((dia) =>
    puedeModificarDia(dia, semana, fechaActual),
  );
}

export function obtenerEstadoVisualDia(dia, semana, fechaActual) {
  if (dia.bloqueado) return "bloqueado";
  if (!puedeModificarDia(dia, semana, fechaActual)) return "vencido";
  if (!dia.plato || dia.plato === "Sin seleccionar") return "sin_seleccionar";
  return "editable";
}

export function obtenerMensajeLimiteModificacion(semana, fechaActual) {
  const puedeModificar = puedeModificarSemana(semana, fechaActual);
  const tipoPlan = semana.tipoPlan || semana.modalidad || "semanal";

  if (semana.estado === "sin_menu") {
    return "El menú todavía no está publicado. Podés dejar sugerencias para esta semana.";
  }

  if (!puedeModificar && semana.estado !== "sin_pedido") {
    return "El plazo para modificar ya terminó. Si necesitás un cambio, comunicate con La Quinta.";
  }

  if (tipoPlan === "diario") {
    return "Cada plato se puede modificar hasta las 09:30 del mismo día.";
  }

  if (tipoPlan === "mixto") {
    return "Algunos días cierran antes y otros se pueden modificar el mismo día.";
  }

  const limite = obtenerLimiteSemanal(semana);
  return `Podés modificar hasta el ${formatearFechaLimite(limite)} a las ${formatearHora(limite)}.`;
}

export function obtenerAccionPrincipalSemana(semana, fechaActual) {
  if (semana.estado === "sin_menu") {
    return tieneSugerenciaEnviada(semana) ? null : "Sugerir menú";
  }

  if (semana.estado === "sin_pedido" || semana.estado === "pendiente") {
    return "Hacer mi pedido";
  }

  if (semana.estado === "confirmado" && puedeModificarSemana(semana, fechaActual)) {
    return "Modificar pedido";
  }

  return "Ver detalle";
}
