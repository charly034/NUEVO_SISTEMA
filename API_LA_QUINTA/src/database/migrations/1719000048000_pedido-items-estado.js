export const up = (pgm) => {
  pgm.createType('pedido_item_estado', ['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado']);

  pgm.addColumns('pedido_items', {
    estado: { type: 'pedido_item_estado', notNull: true, default: 'pendiente' },
    estado_updated_at: { type: 'timestamptz' },
  });

  pgm.sql(`
    UPDATE pedido_items
    SET estado = CASE
      WHEN sin_pedido = TRUE THEN 'cancelado'::pedido_item_estado
      ELSE 'pendiente'::pedido_item_estado
    END
  `);

  pgm.createIndex('pedido_items', 'estado');
};

export const down = (pgm) => {
  pgm.dropIndex('pedido_items', 'estado');
  pgm.dropColumns('pedido_items', ['estado', 'estado_updated_at']);
  pgm.dropType('pedido_item_estado');
};
