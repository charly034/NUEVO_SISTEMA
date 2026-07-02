export function up(pgm) {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificacion_canal') THEN
        CREATE TYPE notificacion_canal AS ENUM ('interna', 'whatsapp');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificacion_evento') THEN
        CREATE TYPE notificacion_evento AS ENUM (
          'manual',
          'nuevo_registro',
          'menu_publicado',
          'pedido_estado_cambiado'
        );
      END IF;
    END
    $$;

    CREATE TABLE IF NOT EXISTS notificacion_reglas (
      id          SERIAL PRIMARY KEY,
      canal       notificacion_canal NOT NULL,
      evento      notificacion_evento NOT NULL DEFAULT 'manual',
      nombre      VARCHAR(160) NOT NULL,
      activo      BOOLEAN NOT NULL DEFAULT TRUE,
      filtros     JSONB NOT NULL DEFAULT '{}'::jsonb,
      titulo      TEXT NOT NULL,
      cuerpo      TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notificacion_reglas_canal_evento
      ON notificacion_reglas (canal, evento, activo);

    CREATE TABLE IF NOT EXISTS notificacion_configuracion (
      clave       VARCHAR(80) PRIMARY KEY,
      valor       JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notificacion_destinatarios_whatsapp (
      id          SERIAL PRIMARY KEY,
      nombre      VARCHAR(160) NOT NULL,
      telefono    VARCHAR(40) NOT NULL,
      email       VARCHAR(255),
      empresa_id  INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
      activo      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notificacion_destinatarios_whatsapp_empresa
      ON notificacion_destinatarios_whatsapp (empresa_id);

    CREATE TABLE IF NOT EXISTS notificacion_envios_whatsapp (
      id              SERIAL PRIMARY KEY,
      regla_id         INTEGER REFERENCES notificacion_reglas(id) ON DELETE SET NULL,
      evento           notificacion_evento NOT NULL,
      destinatario     JSONB NOT NULL,
      payload          JSONB NOT NULL,
      estado           VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      status_code      INTEGER,
      respuesta        TEXT,
      error            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      enviado_at       TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_notificacion_envios_whatsapp_created
      ON notificacion_envios_whatsapp (created_at DESC);

    INSERT INTO notificacion_configuracion (clave, valor)
    VALUES ('whatsapp_n8n', '{"activo": false, "webhook_url": ""}'::jsonb)
    ON CONFLICT (clave) DO NOTHING;

    INSERT INTO notificacion_reglas (canal, evento, nombre, filtros, titulo, cuerpo)
    VALUES
      (
        'interna',
        'menu_publicado',
        'Aviso interno al publicar menu',
        '{"alcance": "todos"}'::jsonb,
        'Menu semanal publicado',
        'Ya podes ver el menu de la semana {{semana_rango}} y cargar tu pedido.'
      ),
      (
        'interna',
        'pedido_estado_cambiado',
        'Aviso interno al cambiar estado de pedido',
        '{"alcance": "empleado_evento"}'::jsonb,
        '{{pedido_estado_titulo}}',
        'El pedido de la semana {{semana_inicio}} paso de {{estado_anterior}} a {{estado}}.'
      ),
      (
        'interna',
        'nuevo_registro',
        'Bienvenida interna al nuevo registro',
        '{"alcance": "empleado_evento"}'::jsonb,
        'Bienvenido a La Quinta',
        'Tu cuenta ya esta lista para ver menus y cargar pedidos.'
      )
    ON CONFLICT DO NOTHING;
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS notificacion_envios_whatsapp;
    DROP TABLE IF EXISTS notificacion_destinatarios_whatsapp;
    DROP TABLE IF EXISTS notificacion_configuracion;
    DROP TABLE IF EXISTS notificacion_reglas;
    DROP TYPE IF EXISTS notificacion_evento;
    DROP TYPE IF EXISTS notificacion_canal;
  `);
}
