export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS planes_vianda (
      id              SERIAL PRIMARY KEY,
      codigo          VARCHAR(80) NOT NULL UNIQUE,
      nombre          VARCHAR(140) NOT NULL,
      descripcion     TEXT,
      gramaje_min     INTEGER NOT NULL,
      gramaje_max     INTEGER,
      incluye_postre  BOOLEAN NOT NULL DEFAULT false,
      incluye_bebida  BOOLEAN NOT NULL DEFAULT false,
      activo          BOOLEAN NOT NULL DEFAULT true,
      orden           INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT planes_vianda_gramaje_check CHECK (
        gramaje_min > 0 AND (gramaje_max IS NULL OR gramaje_max >= gramaje_min)
      )
    );

    INSERT INTO planes_vianda (
      codigo, nombre, descripcion, gramaje_min, gramaje_max,
      incluye_postre, incluye_bebida, activo, orden
    )
    VALUES
      ('clasico_450', 'Plan Clasico 450', 'Vianda 450-500 g', 450, 500, false, false, true, 10),
      ('clasico_450_postre', 'Plan Clasico 450 + Postre', 'Vianda 450-500 g con postre', 450, 500, true, false, true, 20),
      ('clasico_450_bebida', 'Plan Clasico 450 + Bebida', 'Vianda 450-500 g con bebida', 450, 500, false, true, true, 30),
      ('clasico_450_completo', 'Plan Clasico 450 Completo', 'Vianda 450-500 g con postre y bebida', 450, 500, true, true, true, 40),
      ('abundante_600', 'Plan Abundante 600', 'Vianda 600-700 g', 600, 700, false, false, true, 50),
      ('abundante_600_postre', 'Plan Abundante 600 + Postre', 'Vianda 600-700 g con postre', 600, 700, true, false, true, 60),
      ('abundante_600_bebida', 'Plan Abundante 600 + Bebida', 'Vianda 600-700 g con bebida', 600, 700, false, true, true, 70),
      ('abundante_600_completo', 'Plan Abundante 600 Completo', 'Vianda 600-700 g con postre y bebida', 600, 700, true, true, true, 80)
    ON CONFLICT (codigo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      gramaje_min = EXCLUDED.gramaje_min,
      gramaje_max = EXCLUDED.gramaje_max,
      incluye_postre = EXCLUDED.incluye_postre,
      incluye_bebida = EXCLUDED.incluye_bebida,
      activo = EXCLUDED.activo,
      orden = EXCLUDED.orden,
      updated_at = NOW();

    ALTER TABLE empresas
      ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES planes_vianda(id) ON DELETE RESTRICT;

    UPDATE empresas e
    SET plan_id = pv.id
    FROM planes_vianda pv
    WHERE e.plan_id IS NULL
      AND pv.codigo = CASE e.plan::text
        WHEN 'con_postre' THEN 'clasico_450_postre'
        WHEN 'con_postre_bebida' THEN 'clasico_450_completo'
        ELSE 'clasico_450'
      END;

    ALTER TABLE pedidos
      ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES planes_vianda(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS plan_codigo VARCHAR(80),
      ADD COLUMN IF NOT EXISTS plan_nombre VARCHAR(140),
      ADD COLUMN IF NOT EXISTS plan_gramaje_min INTEGER,
      ADD COLUMN IF NOT EXISTS plan_gramaje_max INTEGER,
      ADD COLUMN IF NOT EXISTS plan_incluye_postre BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS plan_incluye_bebida BOOLEAN NOT NULL DEFAULT false;

    UPDATE pedidos p
    SET
      plan_id = pv.id,
      plan_codigo = pv.codigo,
      plan_nombre = pv.nombre,
      plan_gramaje_min = pv.gramaje_min,
      plan_gramaje_max = pv.gramaje_max,
      plan_incluye_postre = pv.incluye_postre,
      plan_incluye_bebida = pv.incluye_bebida
    FROM empresas e
    JOIN planes_vianda pv ON pv.id = e.plan_id
    WHERE p.empresa_id = e.id
      AND p.plan_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_empresas_plan_id ON empresas (plan_id);
    CREATE INDEX IF NOT EXISTS idx_pedidos_plan_id ON pedidos (plan_id);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_pedidos_plan_id;
    DROP INDEX IF EXISTS idx_empresas_plan_id;
    ALTER TABLE pedidos
      DROP COLUMN IF EXISTS plan_incluye_bebida,
      DROP COLUMN IF EXISTS plan_incluye_postre,
      DROP COLUMN IF EXISTS plan_gramaje_max,
      DROP COLUMN IF EXISTS plan_gramaje_min,
      DROP COLUMN IF EXISTS plan_nombre,
      DROP COLUMN IF EXISTS plan_codigo,
      DROP COLUMN IF EXISTS plan_id;
    ALTER TABLE empresas DROP COLUMN IF EXISTS plan_id;
    DROP TABLE IF EXISTS planes_vianda;
  `);
}
