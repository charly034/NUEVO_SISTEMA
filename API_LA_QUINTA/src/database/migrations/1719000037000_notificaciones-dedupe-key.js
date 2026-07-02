export function up(pgm) {
  pgm.sql(`
    ALTER TABLE notificaciones
      ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_notificaciones_dedupe_key
      ON notificaciones (dedupe_key)
      WHERE dedupe_key IS NOT NULL;
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_notificaciones_dedupe_key;

    ALTER TABLE notificaciones
      DROP COLUMN IF EXISTS dedupe_key;
  `);
}
