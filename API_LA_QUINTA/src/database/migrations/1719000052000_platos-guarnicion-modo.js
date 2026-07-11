export function up(pgm) {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'guarnicion_modo') THEN
        CREATE TYPE guarnicion_modo AS ENUM ('sin_guarnicion', 'fija', 'libre');
      END IF;
    END $$;

    ALTER TABLE platos
      ADD COLUMN IF NOT EXISTS guarnicion_modo     guarnicion_modo NULL,
      ADD COLUMN IF NOT EXISTS guarnicion_fija_id  INTEGER         NULL REFERENCES guarniciones(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS nombre_vianda       VARCHAR(200)    NULL;

    UPDATE platos
      SET guarnicion_modo = CASE
        WHEN tiene_guarnicion = true  THEN 'libre'::guarnicion_modo
        ELSE                               'sin_guarnicion'::guarnicion_modo
      END
    WHERE guarnicion_modo IS NULL;

    ALTER TABLE platos
      ALTER COLUMN guarnicion_modo SET NOT NULL,
      ALTER COLUMN guarnicion_modo SET DEFAULT 'sin_guarnicion';

    CREATE INDEX IF NOT EXISTS platos_guarnicion_modo_idx ON platos (guarnicion_modo);
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE platos
      DROP COLUMN IF EXISTS nombre_vianda,
      DROP COLUMN IF EXISTS guarnicion_fija_id,
      DROP COLUMN IF EXISTS guarnicion_modo;

    DROP TYPE IF EXISTS guarnicion_modo;
  `);
}
