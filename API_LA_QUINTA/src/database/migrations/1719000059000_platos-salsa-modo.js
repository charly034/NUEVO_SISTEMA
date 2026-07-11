export function up(pgm) {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'salsa_modo') THEN
        CREATE TYPE salsa_modo AS ENUM ('sin_salsa', 'fija', 'libre');
      END IF;
    END $$;

    ALTER TABLE platos
      ADD COLUMN IF NOT EXISTS salsa_modo    salsa_modo NOT NULL DEFAULT 'sin_salsa',
      ADD COLUMN IF NOT EXISTS salsa_fija_id INTEGER    NULL REFERENCES salsas(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS platos_salsa_modo_idx ON platos (salsa_modo);
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE platos
      DROP COLUMN IF EXISTS salsa_fija_id,
      DROP COLUMN IF EXISTS salsa_modo;

    DROP TYPE IF EXISTS salsa_modo;
  `);
}
