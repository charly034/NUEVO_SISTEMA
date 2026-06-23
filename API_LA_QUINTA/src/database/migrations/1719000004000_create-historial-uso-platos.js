export const up = (pgm) => {
  pgm.createTable('historial_uso_platos', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    plato_id: {
      type: 'integer',
      notNull: true,
      references: '"platos"',
      // Si el plato se elimina, conservamos el registro histórico con null
      onDelete: 'SET NULL',
    },
    // Referencia débil: si se borra el menú semanal, el historial sobrevive con null
    menu_semanal_id: {
      type: 'integer',
      notNull: false,
      references: '"menus_semanales"',
      onDelete: 'SET NULL',
    },
    plato_nombre_snapshot: {
      type: 'varchar(150)',
      notNull: true,
      comment: 'Nombre del plato al momento de asignarlo, por si cambia o se elimina',
    },
    dia: {
      type: 'dia_semana',
      notNull: true,
    },
    opcion: {
      type: 'char(1)',
      notNull: true,
    },
    // Fecha exacta en que se sirvió el plato (calculada desde fecha_inicio del menú + offset del día)
    fecha_servicio: {
      type: 'date',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('historial_uso_platos', 'plato_id');
  pgm.createIndex('historial_uso_platos', 'fecha_servicio');
  pgm.createIndex('historial_uso_platos', 'menu_semanal_id');
};

export const down = (pgm) => {
  pgm.dropTable('historial_uso_platos');
};
