export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS whatsapp_test_logs (
      id             SERIAL PRIMARY KEY,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      destinatario   VARCHAR(80) NOT NULL,
      telefono       VARCHAR(40) NOT NULL,
      nombre         VARCHAR(160) NOT NULL,
      mensaje        TEXT NOT NULL,
      status_code    INTEGER,
      success        BOOLEAN NOT NULL DEFAULT FALSE,
      response_body  JSONB,
      error_code     VARCHAR(80),
      requested_by   INTEGER REFERENCES usuarios_admin(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_whatsapp_test_logs_created
      ON whatsapp_test_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_test_logs_requested_by
      ON whatsapp_test_logs (requested_by, created_at DESC);
  `);
}

export function down(pgm) {
  pgm.sql('DROP TABLE IF EXISTS whatsapp_test_logs;');
}
