export function up(pgm) {
  pgm.sql(`
    ALTER TABLE empresas
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_empresas_deleted_at
      ON empresas (deleted_at);

    CREATE INDEX IF NOT EXISTS idx_empresas_activas_visibles
      ON empresas (activo, nombre)
      WHERE deleted_at IS NULL;
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_empresas_activas_visibles;
    DROP INDEX IF EXISTS idx_empresas_deleted_at;

    ALTER TABLE empresas
      DROP COLUMN IF EXISTS deleted_at;
  `);
}
