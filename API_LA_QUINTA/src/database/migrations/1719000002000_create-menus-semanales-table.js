// Los días de la semana se guardan como enum para evitar strings arbitrarios
// Valores: lunes, martes, miercoles, jueves, viernes, sabado, domingo
export const up = (pgm) => {
  pgm.createType('dia_semana', [
    'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
  ]);

  pgm.createTable('menus_semanales', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    nombre: {
      type: 'varchar(150)',
      notNull: true,
    },
    fecha_inicio: {
      type: 'date',
      notNull: true,
    },
    fecha_fin: {
      type: 'date',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

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

  // Un menú semanal no puede tener el mismo día dos veces
  pgm.addConstraint('menu_semanal_dias', 'unique_menu_dia', 'UNIQUE (menu_semanal_id, dia)');

  pgm.createIndex('menu_semanal_dias', 'menu_semanal_id');
  pgm.createIndex('menus_semanales', 'fecha_inicio');
};

export const down = (pgm) => {
  pgm.dropTable('menu_semanal_dias');
  pgm.dropTable('menus_semanales');
  pgm.dropType('dia_semana');
};
