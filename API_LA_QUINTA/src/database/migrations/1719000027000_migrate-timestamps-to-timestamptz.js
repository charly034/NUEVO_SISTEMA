const TZ = `'America/Argentina/Buenos_Aires'`;

export const up = (pgm) => {
  pgm.sql(`
    -- pedidos
    ALTER TABLE pedidos
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE ${TZ};

    -- pedido_items
    ALTER TABLE pedido_items
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE ${TZ};

    -- pedido_eventos
    ALTER TABLE pedido_eventos
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE ${TZ};

    -- menus_semanales
    ALTER TABLE menus_semanales
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE ${TZ},
      ALTER COLUMN publicado_at TYPE timestamptz USING publicado_at AT TIME ZONE ${TZ},
      ALTER COLUMN cerrado_at TYPE timestamptz USING cerrado_at AT TIME ZONE ${TZ},
      ALTER COLUMN fecha_limite_pedidos TYPE timestamptz USING fecha_limite_pedidos AT TIME ZONE ${TZ};

    -- platos
    ALTER TABLE platos
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE ${TZ};

    -- empleados
    ALTER TABLE empleados
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE ${TZ};

    -- empresas
    ALTER TABLE empresas
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE ${TZ};

    -- historial_uso_platos
    ALTER TABLE historial_uso_platos
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE ${TZ};
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE pedidos
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamp USING updated_at AT TIME ZONE ${TZ};

    ALTER TABLE pedido_items
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamp USING updated_at AT TIME ZONE ${TZ};

    ALTER TABLE pedido_eventos
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE ${TZ};

    ALTER TABLE menus_semanales
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamp USING updated_at AT TIME ZONE ${TZ},
      ALTER COLUMN publicado_at TYPE timestamp USING publicado_at AT TIME ZONE ${TZ},
      ALTER COLUMN cerrado_at TYPE timestamp USING cerrado_at AT TIME ZONE ${TZ},
      ALTER COLUMN fecha_limite_pedidos TYPE timestamp USING fecha_limite_pedidos AT TIME ZONE ${TZ};

    ALTER TABLE platos
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamp USING updated_at AT TIME ZONE ${TZ};

    ALTER TABLE empleados
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamp USING updated_at AT TIME ZONE ${TZ};

    ALTER TABLE empresas
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE ${TZ},
      ALTER COLUMN updated_at TYPE timestamp USING updated_at AT TIME ZONE ${TZ};

    ALTER TABLE historial_uso_platos
      ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE ${TZ};
  `);
};
