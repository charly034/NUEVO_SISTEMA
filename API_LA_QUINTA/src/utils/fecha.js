const OFFSET_DIA = {
  lunes: 0,
  martes: 1,
  miercoles: 2,
  jueves: 3,
  viernes: 4,
  sabado: 5,
  domingo: 6,
};

// Calcula la fecha exacta de servicio sumando el offset del día al lunes (fecha_inicio)
export const calcularFechaServicio = (fechaInicio, dia) => {
  const fecha = new Date(fechaInicio);
  fecha.setUTCDate(fecha.getUTCDate() + OFFSET_DIA[dia]);
  return fecha.toISOString().split('T')[0]; // YYYY-MM-DD
};

// Fragmento SQL para ordenar filas por día de semana (lunes..domingo).
// Fuente única compartida por los repositorios que ordenan por `dia`
// (menus-semanales, cocina) para evitar que la regla de orden diverja.
export const ORDEN_DIA_SQL = `CASE dia
  WHEN 'lunes'     THEN 1
  WHEN 'martes'    THEN 2
  WHEN 'miercoles' THEN 3
  WHEN 'jueves'    THEN 4
  WHEN 'viernes'   THEN 5
  WHEN 'sabado'    THEN 6
  WHEN 'domingo'   THEN 7
END`;
