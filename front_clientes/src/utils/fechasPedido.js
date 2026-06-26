const mesesCortos = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const diasSemana = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

export function formatearRangoPedido(rango) {
  const [inicio, fin] = String(rango || "").split(" al ");
  const [diaInicio, mesInicio] = String(inicio || "").split("/");
  const [diaFin, mesFin] = String(fin || "").split("/");
  const mesInicioTexto = mesesCortos[Number(mesInicio) - 1];
  const mesFinTexto = mesesCortos[Number(mesFin) - 1];

  if (!diaInicio || !diaFin || !mesInicioTexto || !mesFinTexto) return rango;
  return `${Number(diaInicio)} ${mesInicioTexto} al ${Number(diaFin)} ${mesFinTexto}`;
}

export function formatearFechaPedido(fecha, { incluirDiaSemana = false } = {}) {
  const dia = fecha.getDate();
  const mes = mesesCortos[fecha.getMonth()];
  const fechaCorta = `${dia} ${mes}`;

  if (!incluirDiaSemana) return fechaCorta;
  return `${diasSemana[fecha.getDay()]} ${fechaCorta}`;
}
