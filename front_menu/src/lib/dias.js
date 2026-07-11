// Días de la semana — fuente única para todo front_menu.
// Antes cada página definía su propio DIAS_LABEL / DIAS_ORDEN con valores
// inconsistentes (Mié vs Mie, con/sin fin de semana). Centralizado acá.

export const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
export const DIAS_LABORALES = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

// Abreviatura canónica: 3 letras, con acento.
export const DIA_ABREV = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue',
  viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
};

// Nombre completo.
export const DIA_NOMBRE = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

export function indiceDia(dia) {
  return DIAS_ORDEN.indexOf(dia);
}
