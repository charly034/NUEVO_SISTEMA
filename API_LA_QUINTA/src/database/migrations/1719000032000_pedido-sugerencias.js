export const up = (pgm) => {
  pgm.createTable('pedido_sugerencias', {
    id: 'id',
    empleado_id: {
      type: 'integer',
      notNull: true,
      references: '"empleados"',
      onDelete: 'CASCADE',
    },
    empresa_id: {
      type: 'integer',
      notNull: true,
      references: '"empresas"',
      onDelete: 'CASCADE',
    },
    semana_inicio: { type: 'date', notNull: true },
    ideas: { type: 'jsonb', notNull: true, default: '[]' },
    comentario: { type: 'varchar(500)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint(
    'pedido_sugerencias',
    'pedido_sugerencias_empleado_semana_unique',
    'UNIQUE (empleado_id, semana_inicio)',
  );
  pgm.createIndex('pedido_sugerencias', 'empresa_id');
  pgm.createIndex('pedido_sugerencias', 'semana_inicio');
};

export const down = (pgm) => {
  pgm.dropTable('pedido_sugerencias');
};
