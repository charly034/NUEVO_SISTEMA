// Fase S3 del plan "semana como raiz": hacer `semana_id` la fuente dura del
// invariante. Ya toda LECTURA usa semana_id (S2 completo: cocina, estadisticas,
// notificaciones, pedidos, finanzas). Ahora:
//   1. `semana_id` NOT NULL en las 5 tablas ancladas (backfill S1 + auto-populate
//      S2.1 garantizan que ninguna fila -vieja o nueva- quede sin linkear).
//   2. UNIQUE(menus_semanales.semana_id) => 1-1 duro semana<->menu.
//   3. Swap del UNIQUE (empleado_id, semana_inicio) -> (empleado_id, semana_id) en
//      pedidos y las 2 tablas de sugerencias por-empleado; y
//      (semana_inicio, plato_id) -> (semana_id, plato_id) en pedido_sugerencia_opciones
//      (shape distinto: es por-semana+plato, no por-empleado).
//
// Paridad: semana_inicio<->semana_id son 1-1 (misma semana), asi que cada UNIQUE
// nuevo enforcea exactamente el mismo conjunto que el viejo -> el swap no puede
// introducir duplicados. Las columnas de fecha viejas se dropean recien en S4.
//
// El puente auto-populate (set_semana_id, BEFORE INSERT/UPDATE) sigue vivo: los
// INSERT de la app aun escriben semana_inicio/fecha_inicio y el trigger deriva
// semana_id ANTES del chequeo de arbitro del ON CONFLICT (empleado_id, semana_id).
// El codigo de app swappea sus ON CONFLICT a semana_id en el mismo commit.
//
// Pre-flight (D7, remediacion no abort ciego): si quedo alguna semana con >1 menu
// -creada por fuera de la guardia de createMenuSemanal-, RAISE listando los
// semana_id conflictivos antes de intentar el UNIQUE.

export function up(pgm) {
  pgm.sql(`
    -- ── Pre-flight: no puede haber >1 menu por semana (habilita UNIQUE(semana_id)) ──
    DO $$
    DECLARE dups text;
    BEGIN
      SELECT string_agg(semana_id::text || ' (' || cnt || ' menus)', ', ')
        INTO dups
        FROM (
          SELECT semana_id, COUNT(*) AS cnt
          FROM menus_semanales
          GROUP BY semana_id
          HAVING COUNT(*) > 1
        ) d;
      IF dups IS NOT NULL THEN
        RAISE EXCEPTION 'S3 semana-raiz: hay semanas con mas de un menu (semana_id: %). Deduplicar/mergear antes de aplicar UNIQUE(semana_id).', dups;
      END IF;
    END $$;

    -- ── semana_id NOT NULL en las 5 tablas ancladas ────────────────────
    ALTER TABLE menus_semanales            ALTER COLUMN semana_id SET NOT NULL;
    ALTER TABLE pedidos                    ALTER COLUMN semana_id SET NOT NULL;
    ALTER TABLE pedido_sugerencias         ALTER COLUMN semana_id SET NOT NULL;
    ALTER TABLE sugerencias_empleados      ALTER COLUMN semana_id SET NOT NULL;
    ALTER TABLE pedido_sugerencia_opciones ALTER COLUMN semana_id SET NOT NULL;

    -- ── UNIQUE(semana_id) en menus_semanales (1-1 duro semana<->menu) ──
    ALTER TABLE menus_semanales
      ADD CONSTRAINT menus_semanales_semana_id_unique UNIQUE (semana_id);

    -- ── Swap del UNIQUE de pedidos: (empleado_id, semana_inicio) -> (empleado_id, semana_id) ──
    ALTER TABLE pedidos DROP CONSTRAINT pedidos_empleado_semana_unique;
    ALTER TABLE pedidos
      ADD CONSTRAINT pedidos_empleado_semana_id_unique UNIQUE (empleado_id, semana_id);

    -- ── Swap del UNIQUE de pedido_sugerencias ──
    ALTER TABLE pedido_sugerencias DROP CONSTRAINT pedido_sugerencias_empleado_semana_unique;
    ALTER TABLE pedido_sugerencias
      ADD CONSTRAINT pedido_sugerencias_empleado_semana_id_unique UNIQUE (empleado_id, semana_id);

    -- ── Swap del UNIQUE de sugerencias_empleados ──
    ALTER TABLE sugerencias_empleados DROP CONSTRAINT sugerencias_empleados_empleado_id_semana_inicio_key;
    ALTER TABLE sugerencias_empleados
      ADD CONSTRAINT sugerencias_empleados_empleado_semana_id_unique UNIQUE (empleado_id, semana_id);

    -- ── Swap del UNIQUE de pedido_sugerencia_opciones: (semana_inicio, plato_id) -> (semana_id, plato_id) ──
    ALTER TABLE pedido_sugerencia_opciones DROP CONSTRAINT pedido_sugerencia_opciones_semana_plato_unique;
    ALTER TABLE pedido_sugerencia_opciones
      ADD CONSTRAINT pedido_sugerencia_opciones_semana_id_plato_unique UNIQUE (semana_id, plato_id);
  `);
}

export function down(pgm) {
  pgm.sql(`
    -- Revertir swaps (restaurar UNIQUE por fecha)
    ALTER TABLE pedido_sugerencia_opciones DROP CONSTRAINT pedido_sugerencia_opciones_semana_id_plato_unique;
    ALTER TABLE pedido_sugerencia_opciones
      ADD CONSTRAINT pedido_sugerencia_opciones_semana_plato_unique UNIQUE (semana_inicio, plato_id);

    ALTER TABLE sugerencias_empleados DROP CONSTRAINT sugerencias_empleados_empleado_semana_id_unique;
    ALTER TABLE sugerencias_empleados
      ADD CONSTRAINT sugerencias_empleados_empleado_id_semana_inicio_key UNIQUE (empleado_id, semana_inicio);

    ALTER TABLE pedido_sugerencias DROP CONSTRAINT pedido_sugerencias_empleado_semana_id_unique;
    ALTER TABLE pedido_sugerencias
      ADD CONSTRAINT pedido_sugerencias_empleado_semana_unique UNIQUE (empleado_id, semana_inicio);

    ALTER TABLE pedidos DROP CONSTRAINT pedidos_empleado_semana_id_unique;
    ALTER TABLE pedidos
      ADD CONSTRAINT pedidos_empleado_semana_unique UNIQUE (empleado_id, semana_inicio);

    ALTER TABLE menus_semanales DROP CONSTRAINT menus_semanales_semana_id_unique;

    -- Revertir NOT NULL
    ALTER TABLE pedido_sugerencia_opciones ALTER COLUMN semana_id DROP NOT NULL;
    ALTER TABLE sugerencias_empleados      ALTER COLUMN semana_id DROP NOT NULL;
    ALTER TABLE pedido_sugerencias         ALTER COLUMN semana_id DROP NOT NULL;
    ALTER TABLE pedidos                    ALTER COLUMN semana_id DROP NOT NULL;
    ALTER TABLE menus_semanales            ALTER COLUMN semana_id DROP NOT NULL;
  `);
}
