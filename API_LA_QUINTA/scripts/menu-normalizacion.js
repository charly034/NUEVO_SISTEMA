export const FECHAS_INICIO_MENUS_HISTORICOS = [
  '2026-01-26',
  '2026-02-02',
  '2026-02-09',
  '2026-02-16',
  '2026-02-23',
  '2026-03-02',
  '2026-03-09',
  '2026-03-16',
  '2026-03-23',
  '2026-04-06',
  '2026-04-13',
  '2026-04-20',
  '2026-04-27',
  '2026-05-04',
  '2026-05-11',
  '2026-05-18',
  '2026-05-25',
  '2026-06-01',
  '2026-06-08',
  '2026-06-15',
  '2026-06-22',
  '2026-06-29',
  '2026-07-06',
];

const ALIAS_PLATOS = new Map([
  ['mila de carne', 'Milanesa de carne'],
  ['mila de pollo', 'Milanesa de pollo'],
  ['canelones jyq con bolognesa', 'Canelones de JyQ con bolognesa'],
  ['canelones de jyq con bolognesa', 'Canelones de JyQ con bolognesa'],
  ['canelones de jyq con salsa fileto', 'Canelones de JyQ con salsa fileto'],
  ['canelones de jamon y queso con salsa blanca', 'Canelones de Jamón y queso con salsa blanca'],
  ['canelones de jamón y queso con salsa blanca', 'Canelones de Jamón y queso con salsa blanca'],
  ['buenuelos de arroz con ensalada', 'Buñuelos de arroz con ensalada'],
  ['bueñuelos de arroz con ensalada', 'Buñuelos de arroz con ensalada'],
  ['costeleta de cerdo a la riojana con pure de papa', 'Costeletas de cerdo a la Riojana con puré'],
  ['costeleta de cerdo a la riojana con puré de papa', 'Costeletas de cerdo a la Riojana con puré'],
  ['ensalada caesar', 'Ensalada Cesar'],
  ['ensalada cesar', 'Ensalada Cesar'],
  ['fetuchini con albondigas', 'Fetuchini con albóndigas'],
  ['hamburguesa casera de pollo vegetales asados', 'Hamburguesa casera de pollo con vegetales asados'],
  ['medallones de merluza con rusa', 'Medallones de merluza con ensalada rusa'],
  ['mil hojas de berenjena y zuquini', 'Mil hojas de berenjena y zucchini'],
  ['mil hojas de berenjena y zuquini con arroz integral', 'Mil hojas de berenjena y zucchini con arroz integral'],
  ['pan de carne relleno con verduras asadas', 'Pan de carne con verduras asadas'],
  ['papillott de merluza', 'Papillot de merluza'],
  ['papalote de merluza', 'Papillot de merluza'],
  ['pastel papa', 'Pastel de papa'],
  ['rollitos de pollo con pure de zapallos', 'Rollitos de pollo con puré'],
  ['rollitos de pollo con puré de zapallos', 'Rollitos de pollo con puré'],
  ['salpicon', 'Salpicón'],
  ['sorrentinos calabaza con bolognesa', 'Sorrentinos de calabaza con bolognesa'],
  ['spaguetti de espinaca con estofado', 'Spaghetti de espinaca con estofado'],
  ['tacos de carne con ensalasa', 'Tacos de carne con ensalada'],
  ['tarta bicolor c ensalada', 'Tarta bicolor con ensalada'],
  ['tarta caprese con pure mixto', 'Tarta caprese con puré mixto'],
  ['torrejas de arroz y jamon con pure de zapallos', 'Torrejas de arroz y jamón con puré de zapallo'],
  ['torrejas de arroz y jamón con puré de zapallos', 'Torrejas de arroz y jamón con puré de zapallo'],
  ['tortilla de verdura con ensalada', 'Tortilla de verduras con ensalada'],
  ['zapallito relleno con salsa fileto', 'Zapallitos rellenos con salsa fileto'],
]);

export function normalizarClave(nombre) {
  return String(nombre ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function limpiarNombrePlato(valor) {
  return String(valor ?? '')
    .replace(/^[A-Ca-c]:\s*/u, '')
    .replace(/^[\s_]+/u, '')
    .replace(/\s+/g, ' ')
    .replace(/[.]\s*$/u, '')
    .trim();
}

function aplicarCorreccionesBasicas(nombre) {
  return nombre
    .replace(/\bPolllo\b/giu, 'Pollo')
    .replace(/\bPure\b/gu, 'Puré')
    .replace(/\bpure\b/gu, 'puré')
    .replace(/\bMIxto\b/gu, 'mixto')
    .replace(/\bLimon\b/gu, 'Limón')
    .replace(/\blimon\b/gu, 'limón')
    .replace(/\bchampiñon\b/giu, 'champiñón')
    .replace(/\brusticas\b/giu, 'rústicas')
    .replace(/\balbondigas\b/giu, 'albóndigas')
    .replace(/\bHigado\b/gu, 'Hígado')
    .replace(/\bhigado\b/gu, 'hígado')
    .replace(/\bJamon\b/gu, 'Jamón')
    .replace(/\bjamon\b/gu, 'jamón')
    .replace(/\bAtun\b/gu, 'Atún')
    .replace(/\batun\b/gu, 'atún')
    .replace(/\bbudin\b/giu, 'budín')
    .replace(/\bLasagna\b/gu, 'Lasaña')
    .replace(/\blasagna\b/gu, 'lasaña')
    .replace(/\bzuchini\b/giu, 'zucchini')
    .replace(/\bzuquini\b/giu, 'zucchini')
    .replace(/\bensalasa\b/giu, 'ensalada')
    .replace(/\bcon puré de mixto\b/giu, 'con puré mixto')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizarNombre(nombre) {
  if (!nombre) return nombre;
  const lower = nombre.toLowerCase();
  const partes = lower.split(' ');
  partes[0] = partes[0].charAt(0).toUpperCase() + partes[0].slice(1);
  return partes
    .join(' ')
    .replace(/\bjyq\b/giu, 'JyQ')
    .replace(/\briojana\b/giu, 'Riojana')
    .replace(/\bcesar\b/giu, 'Cesar')
    .replace(/\bportuguesa\b/giu, 'Portuguesa');
}

export function canonicalizarNombrePlato(valor) {
  const limpio = aplicarCorreccionesBasicas(limpiarNombrePlato(valor));
  if (!limpio) return '';

  const clave = normalizarClave(limpio);
  const alias = ALIAS_PLATOS.get(clave);
  if (alias) return alias;

  return aplicarCorreccionesBasicas(capitalizarNombre(limpio));
}

export function sumarDias(fechaISO, dias) {
  const [year, month, day] = fechaISO.split('-').map(Number);
  const fecha = new Date(Date.UTC(year, month - 1, day + dias));
  return fecha.toISOString().slice(0, 10);
}

export function fechaFinSemanaHistorica(fechaInicio) {
  return sumarDias(fechaInicio, 6);
}

export function nombreSemanaHistorica(fechaInicio) {
  const [year, month, day] = fechaInicio.split('-').map(Number);
  const lunes = new Date(Date.UTC(year, month - 1, day));
  const domingo = new Date(Date.UTC(year, month - 1, day + 6));
  const fmt = (fecha) => `${fecha.getUTCDate()}/${fecha.getUTCMonth() + 1}`;
  return `Semana del ${fmt(lunes)} al ${fmt(domingo)}`;
}

export function estadoMenuHistorico(fechaInicio, ahora = new Date()) {
  const hoy = [
    ahora.getFullYear(),
    String(ahora.getMonth() + 1).padStart(2, '0'),
    String(ahora.getDate()).padStart(2, '0'),
  ].join('-');
  const fechaFin = fechaFinSemanaHistorica(fechaInicio);

  if (hoy > fechaFin) return 'cerrado';
  if (hoy >= fechaInicio) return 'publicado';
  return 'borrador';
}
