export const up = (pgm) => {
  pgm.createTable('platos', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    nombre: {
      type: 'varchar(150)',
      notNull: true,
    },
    descripcion: {
      type: 'text',
      notNull: false,
    },
    activo: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  pgm.createIndex('platos', 'nombre');
  pgm.createIndex('platos', 'activo');
};

export const down = (pgm) => {
  pgm.dropTable('platos');
};
