export const up = (pgm) => {
  pgm.createTable('pedido_sugerencia_opciones', {
    id: 'id',
    semana_inicio: { type: 'date', notNull: true },
    plato_id: {
      type: 'integer',
      notNull: true,
      references: '"platos"',
      onDelete: 'CASCADE',
    },
    orden: { type: 'integer', notNull: true, default: 0 },
    activo: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint(
    'pedido_sugerencia_opciones',
    'pedido_sugerencia_opciones_semana_plato_unique',
    'UNIQUE (semana_inicio, plato_id)',
  );
  pgm.createIndex('pedido_sugerencia_opciones', 'semana_inicio');
  pgm.createIndex('pedido_sugerencia_opciones', 'plato_id');
};

export const down = (pgm) => {
  pgm.dropTable('pedido_sugerencia_opciones');
};
