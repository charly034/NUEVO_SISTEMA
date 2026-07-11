export const up = (pgm) => {
  pgm.createTable('salsas', {
    id: { type: 'serial', primaryKey: true },
    nombre: { type: 'varchar(100)', notNull: true, unique: true },
    activo: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });
};

export const down = (pgm) => {
  pgm.dropTable('salsas');
};
