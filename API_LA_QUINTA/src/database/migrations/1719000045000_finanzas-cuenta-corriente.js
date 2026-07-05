export function up(pgm) {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pedido_estado_financiero') THEN
        CREATE TYPE pedido_estado_financiero AS ENUM ('pendiente', 'parcial', 'pagado', 'saldo_a_favor');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finanzas_pagador_tipo') THEN
        CREATE TYPE finanzas_pagador_tipo AS ENUM ('empresa', 'empleado');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finanzas_pago_estado') THEN
        CREATE TYPE finanzas_pago_estado AS ENUM ('activo', 'anulado');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finanzas_modalidad_cobro') THEN
        CREATE TYPE finanzas_modalidad_cobro AS ENUM (
          'por_pedido', 'semanal', 'quincenal', 'mensual', 'personalizado', 'a_demanda', 'por_empleado'
        );
      END IF;
    END $$;

    ALTER TABLE pedidos
      ADD COLUMN IF NOT EXISTS estado_financiero pedido_estado_financiero NOT NULL DEFAULT 'pendiente',
      ADD COLUMN IF NOT EXISTS importe_total NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS importe_pagado NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) NOT NULL DEFAULT 'ARS';

    ALTER TABLE pedidos
      ADD CONSTRAINT pedidos_importes_financieros_check
      CHECK (importe_total >= 0 AND importe_pagado >= 0)
      NOT VALID;

    ALTER TABLE pedido_items
      ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS precio_moneda VARCHAR(3) NOT NULL DEFAULT 'ARS';

    ALTER TABLE pedido_items
      ADD CONSTRAINT pedido_items_precio_unitario_check
      CHECK (precio_unitario IS NULL OR precio_unitario >= 0)
      NOT VALID;

    CREATE TABLE IF NOT EXISTS finanzas_configuracion_cobro (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
      empleado_id INTEGER REFERENCES empleados(id) ON DELETE CASCADE,
      modalidad finanzas_modalidad_cobro NOT NULL,
      dia_vencimiento SMALLINT,
      activo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT finanzas_configuracion_cobro_owner_check CHECK (
        (empresa_id IS NOT NULL AND empleado_id IS NULL)
        OR
        (empresa_id IS NULL AND empleado_id IS NOT NULL)
      ),
      CONSTRAINT finanzas_configuracion_cobro_dia_vencimiento_check CHECK (
        dia_vencimiento IS NULL OR (dia_vencimiento BETWEEN 1 AND 31)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_finanzas_config_cobro_empresa_activa
      ON finanzas_configuracion_cobro (empresa_id)
      WHERE activo = true AND empresa_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_finanzas_config_cobro_empleado_activa
      ON finanzas_configuracion_cobro (empleado_id)
      WHERE activo = true AND empleado_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS finanzas_pagos (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE RESTRICT,
      empleado_id INTEGER REFERENCES empleados(id) ON DELETE RESTRICT,
      pagador_tipo finanzas_pagador_tipo NOT NULL,
      monto NUMERIC(12,2) NOT NULL,
      fecha_pago DATE NOT NULL,
      metodo_pago VARCHAR(80) NOT NULL,
      periodo_desde DATE,
      periodo_hasta DATE,
      observacion TEXT,
      comprobante_url TEXT,
      numero_recibo VARCHAR(80),
      estado finanzas_pago_estado NOT NULL DEFAULT 'activo',
      created_by_admin_id INTEGER REFERENCES usuarios_admin(id) ON DELETE SET NULL,
      updated_by_admin_id INTEGER REFERENCES usuarios_admin(id) ON DELETE SET NULL,
      anulado_by_admin_id INTEGER REFERENCES usuarios_admin(id) ON DELETE SET NULL,
      anulado_at TIMESTAMPTZ,
      motivo_anulacion TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT finanzas_pagos_monto_check CHECK (monto > 0),
      CONSTRAINT finanzas_pagos_pagador_check CHECK (
        (pagador_tipo = 'empresa' AND empresa_id IS NOT NULL)
        OR
        (pagador_tipo = 'empleado' AND empleado_id IS NOT NULL)
      ),
      CONSTRAINT finanzas_pagos_periodo_check CHECK (
        periodo_desde IS NULL OR periodo_hasta IS NULL OR periodo_hasta >= periodo_desde
      )
    );

    CREATE INDEX IF NOT EXISTS idx_finanzas_pagos_empresa ON finanzas_pagos (empresa_id, fecha_pago DESC);
    CREATE INDEX IF NOT EXISTS idx_finanzas_pagos_empleado ON finanzas_pagos (empleado_id, fecha_pago DESC);
    CREATE INDEX IF NOT EXISTS idx_finanzas_pagos_estado ON finanzas_pagos (estado);

    CREATE TABLE IF NOT EXISTS finanzas_pago_aplicaciones (
      id SERIAL PRIMARY KEY,
      pago_id INTEGER NOT NULL REFERENCES finanzas_pagos(id) ON DELETE CASCADE,
      pedido_id INTEGER REFERENCES pedidos(id) ON DELETE RESTRICT,
      pedido_item_id INTEGER REFERENCES pedido_items(id) ON DELETE RESTRICT,
      monto_aplicado NUMERIC(12,2) NOT NULL,
      created_by_admin_id INTEGER REFERENCES usuarios_admin(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT finanzas_pago_aplicaciones_destino_check CHECK (
        pedido_id IS NOT NULL OR pedido_item_id IS NOT NULL
      ),
      CONSTRAINT finanzas_pago_aplicaciones_monto_check CHECK (monto_aplicado > 0)
    );

    CREATE INDEX IF NOT EXISTS idx_finanzas_pago_aplicaciones_pago ON finanzas_pago_aplicaciones (pago_id);
    CREATE INDEX IF NOT EXISTS idx_finanzas_pago_aplicaciones_pedido ON finanzas_pago_aplicaciones (pedido_id);
    CREATE INDEX IF NOT EXISTS idx_finanzas_pago_aplicaciones_item ON finanzas_pago_aplicaciones (pedido_item_id);

    CREATE TABLE IF NOT EXISTS finanzas_ajustes (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE RESTRICT,
      empleado_id INTEGER REFERENCES empleados(id) ON DELETE RESTRICT,
      monto NUMERIC(12,2) NOT NULL,
      motivo VARCHAR(180) NOT NULL,
      referencia VARCHAR(180),
      created_by_admin_id INTEGER REFERENCES usuarios_admin(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT finanzas_ajustes_owner_check CHECK (
        (empresa_id IS NOT NULL AND empleado_id IS NULL)
        OR
        (empresa_id IS NULL AND empleado_id IS NOT NULL)
      ),
      CONSTRAINT finanzas_ajustes_monto_check CHECK (monto <> 0)
    );

    CREATE INDEX IF NOT EXISTS idx_finanzas_ajustes_empresa ON finanzas_ajustes (empresa_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_finanzas_ajustes_empleado ON finanzas_ajustes (empleado_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pedidos_estado_financiero ON pedidos (estado_financiero);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_pedidos_estado_financiero;
    DROP INDEX IF EXISTS idx_finanzas_ajustes_empleado;
    DROP INDEX IF EXISTS idx_finanzas_ajustes_empresa;
    DROP TABLE IF EXISTS finanzas_ajustes;
    DROP INDEX IF EXISTS idx_finanzas_pago_aplicaciones_item;
    DROP INDEX IF EXISTS idx_finanzas_pago_aplicaciones_pedido;
    DROP INDEX IF EXISTS idx_finanzas_pago_aplicaciones_pago;
    DROP TABLE IF EXISTS finanzas_pago_aplicaciones;
    DROP INDEX IF EXISTS idx_finanzas_pagos_estado;
    DROP INDEX IF EXISTS idx_finanzas_pagos_empleado;
    DROP INDEX IF EXISTS idx_finanzas_pagos_empresa;
    DROP TABLE IF EXISTS finanzas_pagos;
    DROP INDEX IF EXISTS idx_finanzas_config_cobro_empleado_activa;
    DROP INDEX IF EXISTS idx_finanzas_config_cobro_empresa_activa;
    DROP TABLE IF EXISTS finanzas_configuracion_cobro;

    ALTER TABLE pedido_items
      DROP CONSTRAINT IF EXISTS pedido_items_precio_unitario_check,
      DROP COLUMN IF EXISTS precio_moneda,
      DROP COLUMN IF EXISTS precio_unitario;

    ALTER TABLE pedidos
      DROP CONSTRAINT IF EXISTS pedidos_importes_financieros_check,
      DROP COLUMN IF EXISTS moneda,
      DROP COLUMN IF EXISTS importe_pagado,
      DROP COLUMN IF EXISTS importe_total,
      DROP COLUMN IF EXISTS estado_financiero;

    DROP TYPE IF EXISTS finanzas_modalidad_cobro;
    DROP TYPE IF EXISTS finanzas_pago_estado;
    DROP TYPE IF EXISTS finanzas_pagador_tipo;
    DROP TYPE IF EXISTS pedido_estado_financiero;
  `);
}
