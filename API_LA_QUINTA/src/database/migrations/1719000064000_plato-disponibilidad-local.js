export function up(pgm) {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plato_local_patron') THEN
        CREATE TYPE plato_local_patron AS ENUM ('diario', 'dia_semana', 'fecha');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS plato_disponibilidad_local (
      id SERIAL PRIMARY KEY,
      plato_id INTEGER NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
      patron plato_local_patron NOT NULL,
      dia_semana dia_semana NULL,
      fecha DATE NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT plato_disponibilidad_local_patron_campos_check CHECK (
        (patron = 'diario' AND dia_semana IS NULL AND fecha IS NULL)
        OR (patron = 'dia_semana' AND dia_semana IS NOT NULL AND fecha IS NULL)
        OR (patron = 'fecha' AND fecha IS NOT NULL AND dia_semana IS NULL)
      ),
      CONSTRAINT plato_disponibilidad_local_unique UNIQUE (plato_id, patron, dia_semana, fecha)
    );

    CREATE INDEX IF NOT EXISTS plato_disponibilidad_local_plato_id_idx ON plato_disponibilidad_local (plato_id);
    CREATE INDEX IF NOT EXISTS plato_disponibilidad_local_fecha_idx ON plato_disponibilidad_local (fecha);
    CREATE INDEX IF NOT EXISTS plato_disponibilidad_local_dia_semana_idx ON plato_disponibilidad_local (dia_semana);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS plato_disponibilidad_local;
    DROP TYPE IF EXISTS plato_local_patron;
  `);
}
