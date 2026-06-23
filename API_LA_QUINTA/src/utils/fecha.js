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
