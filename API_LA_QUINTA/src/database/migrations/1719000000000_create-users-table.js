// Migración inicial: crear tabla users
// Usamos SERIAL (entero autoincremental) en lugar de UUID porque:
// - Es más simple y más rápido en joins y búsquedas indexadas
// - UUID tiene ventajas cuando necesitás IDs no predecibles o distribuidos
// - Para la mayoría de proyectos pequeños y medianos, SERIAL es suficiente

export const up = (pgm) => {
  pgm.createTable('users', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    nombre: {
      type: 'varchar(100)',
      notNull: true,
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
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

  // Índice en email para búsquedas rápidas por email
  pgm.createIndex('users', 'email');
};

export const down = (pgm) => {
  pgm.dropTable('users');
};
