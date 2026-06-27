export const up = (pgm) => {
  pgm.addColumns('pedido_items', {
    sin_pedido: { type: 'boolean', notNull: true, default: false },
    origen: { type: 'varchar(20)' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.alterColumn('pedido_items', 'plato_id', { notNull: false });

  pgm.addConstraint(
    'pedido_items',
    'pedido_items_plato_o_sin_pedido_check',
    `CHECK (
      (sin_pedido = true AND plato_id IS NULL)
      OR
      (sin_pedido = false AND plato_id IS NOT NULL)
    )`,
  );
};

export const down = (pgm) => {
  pgm.dropConstraint('pedido_items', 'pedido_items_plato_o_sin_pedido_check');
  pgm.alterColumn('pedido_items', 'plato_id', { notNull: true });
  pgm.dropColumns('pedido_items', ['sin_pedido', 'origen', 'updated_at']);
};
