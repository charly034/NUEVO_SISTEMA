export function up(pgm) {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificacion_tipo') THEN
        CREATE TYPE notificacion_tipo AS ENUM ('menu', 'recordatorio', 'confirmado', 'sistema');
      END IF;
    END
    $$;

    CREATE TABLE IF NOT EXISTS notificaciones (
      id            SERIAL PRIMARY KEY,
      empleado_id   INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
      tipo          notificacion_tipo NOT NULL DEFAULT 'sistema',
      titulo        TEXT NOT NULL,
      cuerpo        TEXT NOT NULL,
      leida         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notificaciones_empleado ON notificaciones (empleado_id);
    CREATE INDEX IF NOT EXISTS idx_notificaciones_no_leidas ON notificaciones (empleado_id, leida) WHERE leida = FALSE;
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS notificaciones;
    DROP TYPE IF EXISTS notificacion_tipo;
  `);
}
