export function up(pgm) {
  pgm.sql(`
    ALTER TABLE platos
      DROP COLUMN IF EXISTS canal;

    DROP TYPE IF EXISTS plato_canal;
  `);
}

export function down(pgm) {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plato_canal') THEN
        CREATE TYPE plato_canal AS ENUM ('vianda', 'local', 'ambos');
      END IF;
    END $$;

    ALTER TABLE platos
      ADD COLUMN IF NOT EXISTS canal plato_canal NOT NULL DEFAULT 'vianda';

    UPDATE platos SET canal = CASE WHEN disponible_vianda THEN 'vianda' ELSE 'local' END;
  `);
}
