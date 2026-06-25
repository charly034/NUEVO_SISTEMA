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
