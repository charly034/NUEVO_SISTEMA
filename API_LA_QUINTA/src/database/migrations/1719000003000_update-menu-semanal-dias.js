// Cambios respecto a la migración anterior:
// 1. menu_semanal_dias ahora permite múltiples platos por día (opcion A, B, C...)
//    Se elimina el UNIQUE(menu_semanal_id, dia) y se reemplaza por
//    UNIQUE(menu_semanal_id, dia, opcion)
// 2. Nueva tabla menu_semanal_sin_servicio para marcar días de feriado o sin servicio

export const up = (pgm) => {
  // Recrear la tabla de días con la nueva estructura
  pgm.dropTable('menu_semanal_dias');

  pgm.createTable('menu_semanal_dias', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    menu_semanal_id: {
      type: 'integer',
      notNull: true,
      references: '"menus_semanales"',
      onDelete: 'CASCADE',
    },
    dia: {
      type: 'dia_semana',
      notNull: true,
    },
    // Opción dentro del día: A, B, C, D...
    // Permite hasta 26 platos por día (más que suficiente)
    opcion: {
      type: 'char(1)',
      notNull: true,
      default: "'A'",
    },
    plato_id: {
      type: 'integer',
      notNull: true,
      references: '"platos"',
      onDelete: 'RESTRICT',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Un menú semanal no puede repetir la misma opción en el mismo día
  pgm.addConstraint(
    'menu_semanal_dias',
    'unique_menu_dia_opcion',
    'UNIQUE (menu_semanal_id, dia, opcion)'
  );

  pgm.createIndex('menu_semanal_dias', 'menu_semanal_id');
  pgm.createIndex('menu_semanal_dias', 'plato_id');

  // Días sin servicio (feriados, cierres, etc.)
  pgm.createTable('menu_semanal_sin_servicio', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    menu_semanal_id: {
      type: 'integer',
      notNull: true,
      references: '"menus_semanales"',
      onDelete: 'CASCADE',
    },
    dia: {
      type: 'dia_semana',
      notNull: true,
    },
    motivo: {
      type: 'varchar(200)',
      notNull: false,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint(
    'menu_semanal_sin_servicio',
    'unique_menu_sin_servicio_dia',
    'UNIQUE (menu_semanal_id, dia)'
  );
};

export const down = (pgm) => {
  pgm.dropTable('menu_semanal_sin_servicio');
  pgm.dropTable('menu_semanal_dias');

  // Recrear la versión anterior simple
  pgm.createTable('menu_semanal_dias', {
    id: { type: 'serial', primaryKey: true },
    menu_semanal_id: { type: 'integer', notNull: true, references: '"menus_semanales"', onDelete: 'CASCADE' },
    dia: { type: 'dia_semana', notNull: true },
    plato_id: { type: 'integer', notNull: true, references: '"platos"', onDelete: 'RESTRICT' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('menu_semanal_dias', 'unique_menu_dia', 'UNIQUE (menu_semanal_id, dia)');
};
