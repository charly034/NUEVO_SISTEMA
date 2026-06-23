export const up = (pgm) => {
  // Eliminar tabla vieja (era prototipo)
  pgm.dropTable('pedidos', { cascade: true });
  pgm.dropType('pedido_estado');

  // Recrear tipo estado
  pgm.createType('pedido_estado', ['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado']);

  // Cabecera del pedido (un pedido por empleado por semana)
  pgm.createTable('pedidos', {
    id: { type: 'serial', primaryKey: true },
    empleado_id: {
      type: 'integer',
      notNull: true,
      references: '"empleados"',
      onDelete: 'RESTRICT',
    },
    empresa_id: {
      type: 'integer',
      notNull: true,
      references: '"empresas"',
      onDelete: 'RESTRICT',
    },
    menu_semanal_id: {
      type: 'integer',
      references: '"menus_semanales"',
      onDelete: 'SET NULL',
    },
    semana_inicio: { type: 'date', notNull: true },
    estado: { type: 'pedido_estado', notNull: true, default: 'pendiente' },
    observaciones: { type: 'text' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });

  // Un pedido no puede repetirse para el mismo empleado y semana
  pgm.addConstraint('pedidos', 'pedidos_empleado_semana_unique', 'UNIQUE (empleado_id, semana_inicio)');
  pgm.createIndex('pedidos', 'empresa_id');
  pgm.createIndex('pedidos', 'semana_inicio');
  pgm.createIndex('pedidos', 'estado');

  // Items: una línea por día pedido
  pgm.createTable('pedido_items', {
    id: { type: 'serial', primaryKey: true },
    pedido_id: {
      type: 'integer',
      notNull: true,
      references: '"pedidos"',
      onDelete: 'CASCADE',
    },
    dia: { type: 'varchar(20)', notNull: true },
    plato_id: {
      type: 'integer',
      notNull: true,
      references: '"platos"',
      onDelete: 'RESTRICT',
    },
    // Para platos variables: A o C. Para fijos: null
    opcion: { type: 'varchar(5)' },
    guarnicion_id: {
      type: 'integer',
      references: '"guarniciones"',
      onDelete: 'SET NULL',
    },
    notas: { type: 'varchar(300)' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });

  // Un empleado no puede pedir dos veces el mismo día en el mismo pedido
  pgm.addConstraint('pedido_items', 'pedido_items_pedido_dia_unique', 'UNIQUE (pedido_id, dia)');
  pgm.createIndex('pedido_items', 'pedido_id');
};

export const down = (pgm) => {
  pgm.dropTable('pedido_items', { cascade: true });
  pgm.dropTable('pedidos', { cascade: true });
  pgm.dropType('pedido_estado');

  pgm.createType('pedido_estado', ['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado']);
  pgm.createTable('pedidos', {
    id: { type: 'serial', primaryKey: true },
    menu_semanal_id: { type: 'integer', references: '"menus_semanales"', onDelete: 'SET NULL' },
    plato_id: { type: 'integer', notNull: true, references: '"platos"', onDelete: 'RESTRICT' },
    dia: { type: 'varchar(20)', notNull: true },
    opcion: { type: 'varchar(5)', notNull: true },
    nombre_cliente: { type: 'varchar(100)' },
    mesa: { type: 'varchar(50)' },
    cantidad: { type: 'integer', notNull: true, default: 1 },
    observaciones: { type: 'text' },
    estado: { type: 'pedido_estado', notNull: true, default: 'pendiente' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });
};
