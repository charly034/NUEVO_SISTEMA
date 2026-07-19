// Fase S1 del plan "semana como raiz": vincular las tablas ancladas por fecha a
// la entidad `semanas` via una FK `semana_id` NULLABLE + backfill. Todavia NO se
// lee `semana_id` en ningun lado (eso es S2) ni es NOT NULL / UNIQUE (eso es S3):
// esta fase es aditiva y no cambia comportamiento.
//
// Arranca con pre-flights que ABORTAN la migracion con mensaje claro si los datos
// no cumplen los invariantes del modelo (fechas no-lunes, spans no canonicos,
// semanas con >1 menu). Es la "remediacion, no abort ciego" de la decision D7:
// el mensaje dice exactamente que arreglar antes de reintentar.

export function up(pgm) {
  pgm.sql(`
    -- ── Pre-flight: invariantes de datos ────────────────────────────────
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM menus_semanales           WHERE EXTRACT(ISODOW FROM fecha_inicio) <> 1)
         OR EXISTS (SELECT 1 FROM pedidos                WHERE EXTRACT(ISODOW FROM semana_inicio) <> 1)
         OR EXISTS (SELECT 1 FROM pedido_sugerencias     WHERE EXTRACT(ISODOW FROM semana_inicio) <> 1)
         OR EXISTS (SELECT 1 FROM sugerencias_empleados  WHERE EXTRACT(ISODOW FROM semana_inicio) <> 1)
         OR EXISTS (SELECT 1 FROM pedido_sugerencia_opciones WHERE EXTRACT(ISODOW FROM semana_inicio) <> 1)
      THEN
        RAISE EXCEPTION 'Pre-flight semana-raiz: hay fechas que no son lunes. Normalizar semana_inicio/fecha_inicio a lunes antes de migrar.';
      END IF;

      IF EXISTS (SELECT 1 FROM menus_semanales WHERE fecha_fin <> fecha_inicio + 6) THEN
        RAISE EXCEPTION 'Pre-flight semana-raiz: hay menus con span no canonico (fecha_fin <> fecha_inicio + 6). Revisar antes de mover fecha_fin a semanas.';
      END IF;

      IF EXISTS (SELECT 1 FROM menus_semanales GROUP BY date_trunc('week', fecha_inicio) HAVING COUNT(*) > 1) THEN
        RAISE EXCEPTION 'Pre-flight semana-raiz: hay semanas con mas de un menu. Deduplicar antes de aplicar UNIQUE(semana_id) en S3.';
      END IF;
    END $$;

    -- ── Columna semana_id NULLABLE + FK + indice ────────────────────────
    ALTER TABLE menus_semanales            ADD COLUMN semana_id integer REFERENCES semanas(id);
    ALTER TABLE pedidos                    ADD COLUMN semana_id integer REFERENCES semanas(id);
    ALTER TABLE pedido_sugerencias         ADD COLUMN semana_id integer REFERENCES semanas(id);
    ALTER TABLE sugerencias_empleados      ADD COLUMN semana_id integer REFERENCES semanas(id);
    ALTER TABLE pedido_sugerencia_opciones ADD COLUMN semana_id integer REFERENCES semanas(id);

    CREATE INDEX menus_semanales_semana_id_idx            ON menus_semanales (semana_id);
    CREATE INDEX pedidos_semana_id_idx                    ON pedidos (semana_id);
    CREATE INDEX pedido_sugerencias_semana_id_idx         ON pedido_sugerencias (semana_id);
    CREATE INDEX sugerencias_empleados_semana_id_idx      ON sugerencias_empleados (semana_id);
    CREATE INDEX pedido_sugerencia_opciones_semana_id_idx ON pedido_sugerencia_opciones (semana_id);

    -- ── Backfill por igualdad de semana (semanas.fecha_inicio = lunes) ──
    UPDATE menus_semanales t            SET semana_id = s.id FROM semanas s WHERE s.fecha_inicio = date_trunc('week', t.fecha_inicio)::date;
    UPDATE pedidos t                    SET semana_id = s.id FROM semanas s WHERE s.fecha_inicio = date_trunc('week', t.semana_inicio)::date;
    UPDATE pedido_sugerencias t         SET semana_id = s.id FROM semanas s WHERE s.fecha_inicio = date_trunc('week', t.semana_inicio)::date;
    UPDATE sugerencias_empleados t      SET semana_id = s.id FROM semanas s WHERE s.fecha_inicio = date_trunc('week', t.semana_inicio)::date;
    UPDATE pedido_sugerencia_opciones t SET semana_id = s.id FROM semanas s WHERE s.fecha_inicio = date_trunc('week', t.semana_inicio)::date;

    -- ── Post-backfill: toda fila debe haber quedado linkeada ────────────
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM menus_semanales           WHERE semana_id IS NULL)
         OR EXISTS (SELECT 1 FROM pedidos                WHERE semana_id IS NULL)
         OR EXISTS (SELECT 1 FROM pedido_sugerencias     WHERE semana_id IS NULL)
         OR EXISTS (SELECT 1 FROM sugerencias_empleados  WHERE semana_id IS NULL)
         OR EXISTS (SELECT 1 FROM pedido_sugerencia_opciones WHERE semana_id IS NULL)
      THEN
        RAISE EXCEPTION 'Backfill semana-raiz: quedaron filas sin semana_id. Falta alguna semana en el catalogo (revisar S0).';
      END IF;
    END $$;
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS menus_semanales_semana_id_idx;
    DROP INDEX IF EXISTS pedidos_semana_id_idx;
    DROP INDEX IF EXISTS pedido_sugerencias_semana_id_idx;
    DROP INDEX IF EXISTS sugerencias_empleados_semana_id_idx;
    DROP INDEX IF EXISTS pedido_sugerencia_opciones_semana_id_idx;
    ALTER TABLE menus_semanales            DROP COLUMN IF EXISTS semana_id;
    ALTER TABLE pedidos                    DROP COLUMN IF EXISTS semana_id;
    ALTER TABLE pedido_sugerencias         DROP COLUMN IF EXISTS semana_id;
    ALTER TABLE sugerencias_empleados      DROP COLUMN IF EXISTS semana_id;
    ALTER TABLE pedido_sugerencia_opciones DROP COLUMN IF EXISTS semana_id;
  `);
}
