export function up(pgm) {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plato_canal') THEN
        CREATE TYPE plato_canal AS ENUM ('vianda', 'local', 'ambos');
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plato_disponibilidad') THEN
        CREATE TYPE plato_disponibilidad AS ENUM ('especial', 'fijo_dia', 'siempre');
      END IF;
    END $$;

    ALTER TABLE platos
      ADD COLUMN IF NOT EXISTS canal          plato_canal         NOT NULL DEFAULT 'vianda',
      ADD COLUMN IF NOT EXISTS disponibilidad plato_disponibilidad NOT NULL DEFAULT 'especial',
      ADD COLUMN IF NOT EXISTS dia_fijo       dia_semana          NULL;

    CREATE INDEX IF NOT EXISTS platos_canal_idx          ON platos (canal);
    CREATE INDEX IF NOT EXISTS platos_disponibilidad_idx ON platos (disponibilidad);
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE platos
      DROP COLUMN IF EXISTS dia_fijo,
      DROP COLUMN IF EXISTS disponibilidad,
      DROP COLUMN IF EXISTS canal;

    DROP TYPE IF EXISTS plato_disponibilidad;
    DROP TYPE IF EXISTS plato_canal;
  `);
}
