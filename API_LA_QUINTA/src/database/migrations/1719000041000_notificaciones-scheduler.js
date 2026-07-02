export function up(pgm) {
  pgm.sql(`
    ALTER TABLE notificacion_reglas
      ADD COLUMN IF NOT EXISTS programacion JSONB NOT NULL DEFAULT '{}'::jsonb;

    CREATE TABLE IF NOT EXISTS notificacion_ejecuciones_programadas (
      id           SERIAL PRIMARY KEY,
      regla_id     INTEGER NOT NULL REFERENCES notificacion_reglas(id) ON DELETE CASCADE,
      run_key      TEXT NOT NULL,
      estado       VARCHAR(20) NOT NULL DEFAULT 'en_proceso',
      resultado    JSONB NOT NULL DEFAULT '{}'::jsonb,
      error        TEXT,
      started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at  TIMESTAMPTZ,
      UNIQUE (regla_id, run_key)
    );

    CREATE INDEX IF NOT EXISTS idx_notificacion_ejecuciones_programadas_started
      ON notificacion_ejecuciones_programadas (started_at DESC);

  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS notificacion_ejecuciones_programadas;

    ALTER TABLE notificacion_reglas
      DROP COLUMN IF EXISTS programacion;
  `);
}
