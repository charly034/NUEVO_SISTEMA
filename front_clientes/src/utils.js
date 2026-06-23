export const DIAS_LABEL = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

export const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
export const DIAS_SEMANA_SABADO = [...DIAS_SEMANA, 'sabado'];
export const DIAS_SEMANA_COMPLETA = [...DIAS_SEMANA, 'sabado', 'domingo'];

export function getDiasSemana(dias_laborales) {
  if (dias_laborales === 'lunes_domingo') return DIAS_SEMANA_COMPLETA;
  if (dias_laborales === 'lunes_sabado') return DIAS_SEMANA_SABADO;
  return DIAS_SEMANA;
}

function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function getLunesDeEstaSemana() {
  const hoy = new Date();
  const offset = (hoy.getDay() + 6) % 7; // lun=0 ... dom=6
  return localISO(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - offset));
}

export function formatFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function addDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return localISO(new Date(y, m - 1, d + n));
}
