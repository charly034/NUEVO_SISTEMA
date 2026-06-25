// La tabla `users` fue la tabla inicial del proyecto pero quedó en desuso.
// Los usuarios ahora se manejan a través de las tablas `empleados` y `usuarios_admin`.
// La tabla se dropea solo si existe y está vacía para evitar pérdida de datos accidental.
export const up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        IF (SELECT COUNT(*) FROM users) = 0 THEN
          DROP TABLE users;
        ELSE
          RAISE NOTICE 'Tabla users no eliminada porque contiene datos.';
        END IF;
      END IF;
    END;
    $$;
  `);
};

export const down = (pgm) => {
  pgm.createTable('users', {
    id: { type: 'serial', primaryKey: true },
    nombre: { type: 'varchar(100)', notNull: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('users', 'email');
};
