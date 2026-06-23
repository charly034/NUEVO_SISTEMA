export const up = (pgm) => {
  pgm.createType('pedido_estado', ['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado']);

  pgm.createTable('pedidos', {
    id: { type: 'serial', primaryKey: true },
    menu_semanal_id: {
      type: 'integer',
      references: '"menus_semanales"',
      onDelete: 'SET NULL',
    },
    plato_id: {
      type: 'integer',
      notNull: true,
      references: '"platos"',
      onDelete: 'RESTRICT',
    },
    dia: { type: 'varchar(20)', notNull: true },
    opcion: { type: 'varchar(5)', notNull: true },
    nombre_cliente: { type: 'varchar(100)' },
    mesa: { type: 'varchar(50)' },
    cantidad: { type: 'integer', notNull: true, default: 1 },
    observaciones: { type: 'text' },
    estado: { type: 'pedido_estado', notNull: true, default: 'pendiente' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('pedidos', 'estado');
  pgm.createIndex('pedidos', 'created_at');
  pgm.createIndex('pedidos', 'menu_semanal_id');
};

export const down = (pgm) => {
  pgm.dropTable('pedidos');
  pgm.dropType('pedido_estado');
};
