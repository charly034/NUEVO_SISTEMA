// Fechas y semanas — fuente única para todo front_menu.
// Primitivas canónicas (antes vivían en hooks/useFechaOperativa.js) + helpers
// de formato que cada página reimplementaba (getLunes, formatFecha, formatRangoSemana).

export const APP_TIMEZONE = 'America/Argentina/Buenos_Aires';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// --- Primitivas ISO (independientes de zona salvo fechaISOEnZona) ---

export function fechaISOEnZona(valor = new Date(), timeZone = APP_TIMEZONE) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  const base = Number.isNaN(fecha.getTime()) ? new Date() : fecha;
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base);

  const porTipo = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${porTipo.year}-${porTipo.month}-${porTipo.day}`;
}

export function addDiasISO(fechaISO, dias) {
  const base = new Date(`${fechaISO}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().split('T')[0];
}

export function indiceDiaSemanaISO(fechaISO) {
  const base = new Date(`${fechaISO}T12:00:00.000Z`);
  return (base.getUTCDay() + 6) % 7;
}

export function lunesDeSemanaISO(fechaISO, offset = 0) {
  return addDiasISO(fechaISO, -indiceDiaSemanaISO(fechaISO) + offset * 7);
}

// Lunes de la semana operativa actual (según zona horaria del negocio).
export function lunesActualISO(offset = 0) {
  return lunesDeSemanaISO(fechaISOEnZona(), offset);
}

// --- Formato ---

// dd/mm/yyyy. Acepta fecha con o sin componente de hora (slice a 10).
export function formatFechaCorta(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

// "5 de julio"
export function formatFechaLarga(iso) {
  if (!iso) return '';
  const [, m, d] = String(iso).slice(0, 10).split('-');
  if (!m || !d) return '';
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]}`;
}

// Rango lunes→viernes: "5 al 9 de julio" o "29 de junio al 3 de julio".
export function formatRangoSemana(lunesISO) {
  if (!lunesISO) return '';
  const [y, m, d] = String(lunesISO).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const fin = new Date(y, m - 1, d + 4);
  const mesInicio = MESES[m - 1];
  const mesFin = MESES[fin.getMonth()];
  if (mesInicio === mesFin) return `${d} al ${fin.getDate()} de ${mesInicio}`;
  return `${d} de ${mesInicio} al ${fin.getDate()} de ${mesFin}`;
}
