export function up(pgm) {
  pgm.sql(`
    ALTER TABLE platos
      ADD COLUMN IF NOT EXISTS disponible_vianda BOOLEAN NOT NULL DEFAULT true;

    UPDATE platos SET disponible_vianda = (canal IS NULL OR canal <> 'local');

    CREATE INDEX IF NOT EXISTS platos_disponible_vianda_idx ON platos (disponible_vianda);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS platos_disponible_vianda_idx;
    ALTER TABLE platos DROP COLUMN IF EXISTS disponible_vianda;
  `);
}
