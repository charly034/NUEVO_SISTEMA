export const up = (pgm) => {
  pgm.addColumn('empresas', {
    limite_hora: {
      type: 'time',
      comment: 'Hora de corte para aceptar pedidos (ej: 10:00)',
    },
    // Solo aplica para modo_pedido = semanal: qué día de la semana es el límite
    limite_dia_semana: {
      type: 'varchar(20)',
      comment: 'Para pedido semanal: día de corte (lunes, martes, etc)',
    },
    // Para modo_pedido = diario: 0 = mismo día, 1 = día anterior
    limite_anticipacion_dias: {
      type: 'smallint',
      default: 0,
      comment: 'Para pedido diario: días de anticipación requeridos',
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('empresas', 'limite_hora');
  pgm.dropColumn('empresas', 'limite_dia_semana');
  pgm.dropColumn('empresas', 'limite_anticipacion_dias');
};
