export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS admin_auditoria (
      id            SERIAL PRIMARY KEY,
      admin_id      INTEGER REFERENCES usuarios_admin(id) ON DELETE SET NULL,
      admin_email   VARCHAR(255),
      admin_nombre  VARCHAR(180),
      accion        VARCHAR(80) NOT NULL,
      entidad_tipo  VARCHAR(80) NOT NULL,
      entidad_id    VARCHAR(80),
      resumen       TEXT,
      antes         JSONB,
      despues       JSONB,
      metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_admin_auditoria_created
      ON admin_auditoria (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_auditoria_entidad
      ON admin_auditoria (entidad_tipo, entidad_id);
    CREATE INDEX IF NOT EXISTS idx_admin_auditoria_admin
      ON admin_auditoria (admin_id, created_at DESC);
  `);
}

export function down(pgm) {
  pgm.sql('DROP TABLE IF EXISTS admin_auditoria;');
}
