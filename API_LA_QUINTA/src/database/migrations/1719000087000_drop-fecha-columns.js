// Fase S4 (limpieza) del plan "semana como raiz": `semana_id` es la unica fuente.
// Toda LECTURA y ESCRITURA de la app ya usa semana_id / JOIN semanas (S2/S3/S4-code):
//   - Los menus cuelgan de semanas (create/update/duplicate setean semana_id; los
//     reads exponen fecha_inicio/fecha_fin vIa JOIN semanas).
//   - pedidos/sugerencias hacen getOrCreate de la semana inline en el write (CTE)
//     y ON CONFLICT (empleado_id, semana_id); los reads leen se.fecha_inicio.
//
// Por eso ahora:
//   1. Se retira el PUENTE auto-populate (trigger set_semana_id, mig. 1719000085000):
//      leia NEW.semana_inicio/fecha_inicio para derivar semana_id; esas columnas se
//      dropean, y el codigo ya setea semana_id directo, asi que sobra.
//   2. Se DROPEAN las columnas de fecha redundantes (sus indices caen en cascada):
//      pedidos.semana_inicio, menus_semanales.fecha_inicio/fecha_fin, y semana_inicio
//      de las 3 tablas de sugerencias.
//
// Seguridad verificada antes del drop: sin vistas dependientes; el trigger
// trg_bloquear_desactivar_vianda ya fue reescrito (mig. 1719000084000) a JOIN semanas
// (no toca estas columnas) -> el DROP no deja un landmine de runtime.

export function up(pgm) {
  pgm.sql(`
    -- ── 1. Retirar el puente auto-populate (ya no se necesita) ──────────
    DROP TRIGGER IF EXISTS set_semana_id ON pedidos;
    DROP TRIGGER IF EXISTS set_semana_id ON pedido_sugerencias;
    DROP TRIGGER IF EXISTS set_semana_id ON sugerencias_empleados;
    DROP TRIGGER IF EXISTS set_semana_id ON pedido_sugerencia_opciones;
    DROP TRIGGER IF EXISTS set_semana_id ON menus_semanales;
    DROP FUNCTION IF EXISTS set_semana_id_from_semana_inicio();
    DROP FUNCTION IF EXISTS set_semana_id_from_fecha_inicio();

    -- ── 2. Drop de columnas de fecha redundantes (indices caen en cascada) ──
    ALTER TABLE pedidos                    DROP COLUMN semana_inicio;
    ALTER TABLE pedido_sugerencias         DROP COLUMN semana_inicio;
    ALTER TABLE sugerencias_empleados      DROP COLUMN semana_inicio;
    ALTER TABLE pedido_sugerencia_opciones DROP COLUMN semana_inicio;
    ALTER TABLE menus_semanales            DROP COLUMN fecha_inicio;
    ALTER TABLE menus_semanales            DROP COLUMN fecha_fin;
  `);
}

export function down(pgm) {
  pgm.sql(`
    -- ── Re-agregar columnas (nullable), backfill desde semanas via semana_id ──
    ALTER TABLE pedidos                    ADD COLUMN semana_inicio date;
    ALTER TABLE pedido_sugerencias         ADD COLUMN semana_inicio date;
    ALTER TABLE sugerencias_empleados      ADD COLUMN semana_inicio date;
    ALTER TABLE pedido_sugerencia_opciones ADD COLUMN semana_inicio date;
    ALTER TABLE menus_semanales            ADD COLUMN fecha_inicio date;
    ALTER TABLE menus_semanales            ADD COLUMN fecha_fin date;

    UPDATE pedidos t                    SET semana_inicio = s.fecha_inicio FROM semanas s WHERE s.id = t.semana_id;
    UPDATE pedido_sugerencias t         SET semana_inicio = s.fecha_inicio FROM semanas s WHERE s.id = t.semana_id;
    UPDATE sugerencias_empleados t      SET semana_inicio = s.fecha_inicio FROM semanas s WHERE s.id = t.semana_id;
    UPDATE pedido_sugerencia_opciones t SET semana_inicio = s.fecha_inicio FROM semanas s WHERE s.id = t.semana_id;
    UPDATE menus_semanales t            SET fecha_inicio = s.fecha_inicio, fecha_fin = s.fecha_fin FROM semanas s WHERE s.id = t.semana_id;

    ALTER TABLE pedidos                    ALTER COLUMN semana_inicio SET NOT NULL;
    ALTER TABLE pedido_sugerencias         ALTER COLUMN semana_inicio SET NOT NULL;
    ALTER TABLE sugerencias_empleados      ALTER COLUMN semana_inicio SET NOT NULL;
    ALTER TABLE pedido_sugerencia_opciones ALTER COLUMN semana_inicio SET NOT NULL;
    ALTER TABLE menus_semanales            ALTER COLUMN fecha_inicio SET NOT NULL;
    ALTER TABLE menus_semanales            ALTER COLUMN fecha_fin SET NOT NULL;

    CREATE INDEX pedidos_semana_inicio_index                    ON pedidos (semana_inicio);
    CREATE INDEX pedido_sugerencias_semana_inicio_index         ON pedido_sugerencias (semana_inicio);
    CREATE INDEX idx_sugerencias_empleados_semana               ON sugerencias_empleados (semana_inicio);
    CREATE INDEX pedido_sugerencia_opciones_semana_inicio_index ON pedido_sugerencia_opciones (semana_inicio);
    CREATE INDEX menus_semanales_fecha_inicio_index             ON menus_semanales (fecha_inicio);

    -- ── Recrear el puente auto-populate (idempotente getOrCreate en BEFORE) ──
    CREATE OR REPLACE FUNCTION set_semana_id_from_semana_inicio()
    RETURNS TRIGGER AS $F$
    DECLARE v_lunes date;
    BEGIN
      v_lunes := date_trunc('week', NEW.semana_inicio)::date;
      INSERT INTO semanas (fecha_inicio, fecha_fin) VALUES (v_lunes, v_lunes + 6)
        ON CONFLICT (fecha_inicio) DO NOTHING;
      SELECT id INTO NEW.semana_id FROM semanas WHERE fecha_inicio = v_lunes;
      RETURN NEW;
    END;
    $F$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION set_semana_id_from_fecha_inicio()
    RETURNS TRIGGER AS $F$
    DECLARE v_lunes date;
    BEGIN
      v_lunes := date_trunc('week', NEW.fecha_inicio)::date;
      INSERT INTO semanas (fecha_inicio, fecha_fin) VALUES (v_lunes, v_lunes + 6)
        ON CONFLICT (fecha_inicio) DO NOTHING;
      SELECT id INTO NEW.semana_id FROM semanas WHERE fecha_inicio = v_lunes;
      RETURN NEW;
    END;
    $F$ LANGUAGE plpgsql;

    CREATE TRIGGER set_semana_id BEFORE INSERT OR UPDATE OF semana_inicio ON pedidos
      FOR EACH ROW EXECUTE FUNCTION set_semana_id_from_semana_inicio();
    CREATE TRIGGER set_semana_id BEFORE INSERT OR UPDATE OF semana_inicio ON pedido_sugerencias
      FOR EACH ROW EXECUTE FUNCTION set_semana_id_from_semana_inicio();
    CREATE TRIGGER set_semana_id BEFORE INSERT OR UPDATE OF semana_inicio ON sugerencias_empleados
      FOR EACH ROW EXECUTE FUNCTION set_semana_id_from_semana_inicio();
    CREATE TRIGGER set_semana_id BEFORE INSERT OR UPDATE OF semana_inicio ON pedido_sugerencia_opciones
      FOR EACH ROW EXECUTE FUNCTION set_semana_id_from_semana_inicio();
    CREATE TRIGGER set_semana_id BEFORE INSERT OR UPDATE OF fecha_inicio ON menus_semanales
      FOR EACH ROW EXECUTE FUNCTION set_semana_id_from_fecha_inicio();
  `);
}
