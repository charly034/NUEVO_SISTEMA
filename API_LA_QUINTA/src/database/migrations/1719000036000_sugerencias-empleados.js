export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS sugerencias_empleados (
      id              SERIAL PRIMARY KEY,
      empleado_id     INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
      semana_inicio   DATE NOT NULL,
      ideas           TEXT NOT NULL,
      comentario      TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (empleado_id, semana_inicio)
    );

    CREATE INDEX IF NOT EXISTS idx_sugerencias_empleados_semana ON sugerencias_empleados (semana_inicio);
  `);
}

export function down(pgm) {
  pgm.sql(`DROP TABLE IF EXISTS sugerencias_empleados;`);
}
