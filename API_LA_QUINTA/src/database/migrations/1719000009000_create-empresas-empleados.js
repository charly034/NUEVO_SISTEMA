export const up = (pgm) => {
  pgm.createType('empresa_plan', ['basico', 'con_postre', 'con_postre_bebida']);
  pgm.createType('pedido_modo', ['semanal', 'diario', 'ambos']);

  pgm.createTable('empresas', {
    id: { type: 'serial', primaryKey: true },
    nombre: { type: 'varchar(150)', notNull: true },
    slug: { type: 'varchar(50)', notNull: true, unique: true },
    plan: { type: 'empresa_plan', notNull: true, default: 'basico' },
    modo_pedido: { type: 'pedido_modo', notNull: true, default: 'semanal' },
    activo: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createTable('empleados', {
    id: { type: 'serial', primaryKey: true },
    empresa_id: {
      type: 'integer',
      notNull: true,
      references: '"empresas"',
      onDelete: 'CASCADE',
    },
    nombre: { type: 'varchar(100)', notNull: true },
    apellido: { type: 'varchar(100)', notNull: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    activo: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('empleados', 'empresa_id');
  pgm.createIndex('empleados', 'email');
};

export const down = (pgm) => {
  pgm.dropTable('empleados');
  pgm.dropTable('empresas');
  pgm.dropType('pedido_modo');
  pgm.dropType('empresa_plan');
};
