export const up = (pgm) => {
  pgm.createTable('pedido_eventos', {
    id: 'id',
    pedido_id: {
      type: 'integer',
      notNull: true,
      references: '"pedidos"',
      onDelete: 'CASCADE',
    },
    tipo: {
      type: 'varchar(40)',
      notNull: true,
      comment: 'pedido_creado, pedido_actualizado, pedido_cancelado, estado_cambiado',
    },
    actor_tipo: {
      type: 'varchar(20)',
      notNull: true,
      comment: 'empleado, admin o sistema',
    },
    actor_id: { type: 'integer' },
    actor_nombre: { type: 'varchar(160)' },
    estado_anterior: { type: 'varchar(30)' },
    estado_nuevo: { type: 'varchar(30)' },
    resumen: { type: 'text' },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.sql(`
    INSERT INTO pedido_eventos (
      pedido_id, tipo, actor_tipo, actor_nombre,
      estado_nuevo, resumen, metadata, created_at
    )
    SELECT
      id,
      'pedido_creado',
      'sistema',
      'Migracion inicial',
      estado,
      'Evento inicial generado al activar auditoria de pedidos',
      jsonb_build_object('origen', 'migracion_sprint_3'),
      created_at
    FROM pedidos
  `);

  pgm.createIndex('pedido_eventos', 'pedido_id');
  pgm.createIndex('pedido_eventos', 'created_at');
  pgm.createIndex('pedido_eventos', ['pedido_id', 'created_at']);
};

export const down = (pgm) => {
  pgm.dropTable('pedido_eventos');
};
