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
