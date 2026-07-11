export const DIAS_LABEL = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

// Abreviatura canónica: 3 letras, con acento.
export const DIA_ABREV = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue',
  viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
};

export const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
export const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
export const DIAS_SEMANA_SABADO = [...DIAS_SEMANA, 'sabado'];
export const DIAS_SEMANA_COMPLETA = [...DIAS_SEMANA, 'sabado', 'domingo'];

export function indiceDia(dia) {
  return DIAS_ORDEN.indexOf(dia);
}

export function getDiasSemana(dias_laborales) {
  if (dias_laborales === 'lunes_domingo') return DIAS_SEMANA_COMPLETA;
  if (dias_laborales === 'lunes_sabado') return DIAS_SEMANA_SABADO;
  return DIAS_SEMANA;
}
