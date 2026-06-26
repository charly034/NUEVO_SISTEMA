const TZ = `'America/Argentina/Buenos_Aires'`;

const TIMESTAMP_COLUMNS = [
  ['pedidos', 'created_at'],
  ['pedidos', 'updated_at'],
  ['pedido_items', 'created_at'],
  ['pedido_items', 'updated_at'],
  ['pedido_eventos', 'created_at'],
  ['menus_semanales', 'created_at'],
  ['menus_semanales', 'updated_at'],
  ['menus_semanales', 'publicado_at'],
  ['menus_semanales', 'cerrado_at'],
  ['menus_semanales', 'fecha_limite_pedidos'],
  ['platos', 'created_at'],
  ['platos', 'updated_at'],
  ['empleados', 'created_at'],
  ['empleados', 'updated_at'],
  ['empresas', 'created_at'],
  ['empresas', 'updated_at'],
  ['historial_uso_platos', 'created_at'],
];

function alterIfExistsSql(targetType) {
  return TIMESTAMP_COLUMNS.map(([table, column]) => `
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${table}'
        AND column_name = '${column}'
    ) THEN
      ALTER TABLE ${table}
        ALTER COLUMN ${column} TYPE ${targetType}
        USING ${column} AT TIME ZONE ${TZ};
    END IF;
  `).join('\n');
}

export const up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      ${alterIfExistsSql('timestamptz')}
    END $$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      ${alterIfExistsSql('timestamp')}
    END $$;
  `);
};
