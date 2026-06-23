export const up = (pgm) => {
  pgm.createTable('usuarios_admin', {
    id:            { type: 'serial', primaryKey: true },
    nombre:        { type: 'varchar(100)', notNull: true },
    apellido:      { type: 'varchar(100)', notNull: true },
    email:         { type: 'varchar(200)', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    rol:           { type: 'varchar(20)', notNull: true, default: 'admin' }, // 'superadmin' | 'admin'
    activo:        { type: 'boolean', notNull: true, default: true },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // Migrar el admin actual de empleados a usuarios_admin
  pgm.sql(`
    INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol, activo)
    SELECT nombre, apellido, email, password_hash, 'superadmin', activo
    FROM empleados
    WHERE rol = 'admin'
    ON CONFLICT (email) DO NOTHING;
  `);

  // Eliminar admins de la tabla empleados
  pgm.sql(`DELETE FROM empleados WHERE rol = 'admin';`);
};

export const down = (pgm) => {
  // Restaurar admins a empleados (sin empresa_id — solo para rollback de emergencia)
  pgm.sql(`
    INSERT INTO empleados (nombre, apellido, email, password_hash, rol, activo, empresa_id)
    SELECT ua.nombre, ua.apellido, ua.email, ua.password_hash, 'admin', ua.activo,
           (SELECT id FROM empresas ORDER BY id LIMIT 1)
    FROM usuarios_admin ua
    ON CONFLICT (email) DO NOTHING;
  `);
  pgm.dropTable('usuarios_admin');
};
