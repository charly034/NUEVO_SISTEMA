// Fase S2 del plan "semana como raiz" (chunk trigger). Reescribe la funcion
// trg_bloquear_desactivar_vianda para leer la semana via `semana_id` (JOIN
// semanas) en vez de `pedidos.semana_inicio` / `menus_semanales.fecha_fin`.
//
// CRITICO: dropear esas columnas (S4) NO falla en el DROP porque el cuerpo
// plpgsql no se parsea; reventaria en RUNTIME al desactivar una vianda. Este
// chunk lo previene ANTES del drop (hallazgo de la voz externa del eng-review).
// El trigger `viandas_bloquear_desactivacion` no se recrea: CREATE OR REPLACE
// FUNCTION actualiza el cuerpo y el trigger sigue apuntando a el.

export function up(pgm) {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION trg_bloquear_desactivar_vianda()
    RETURNS TRIGGER AS $F$
    DECLARE
      v_menu_count    INTEGER;
      v_pedido_count  INTEGER;
    BEGIN
      IF OLD.activo = true AND NEW.activo = false THEN
        SELECT COUNT(*) INTO v_menu_count
        FROM menu_semanal_dias msd
        JOIN menus_semanales ms ON ms.id = msd.menu_semanal_id
        JOIN semanas sm ON sm.id = ms.semana_id
        WHERE msd.vianda_id = NEW.id AND sm.fecha_fin >= CURRENT_DATE;

        SELECT COUNT(*) INTO v_pedido_count
        FROM pedido_items pi
        JOIN pedidos p ON p.id = pi.pedido_id
        JOIN semanas se ON se.id = p.semana_id
        WHERE pi.plato_id = NEW.plato_id
          AND pi.guarnicion_id IS NOT DISTINCT FROM NEW.guarnicion_id
          AND pi.salsa_id IS NOT DISTINCT FROM NEW.salsa_id
          AND p.estado != 'cancelado'
          AND se.fecha_inicio >= date_trunc('week', CURRENT_DATE)::date;

        IF v_menu_count > 0 OR v_pedido_count > 0 THEN
          RAISE EXCEPTION 'No se puede desactivar la vianda "%": en uso en % menu(s) de semana vigente y % pedido(s) activo(s)', NEW.nombre_vianda, v_menu_count, v_pedido_count
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $F$ LANGUAGE plpgsql;
  `);
}

export function down(pgm) {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION trg_bloquear_desactivar_vianda()
    RETURNS TRIGGER AS $F$
    DECLARE
      v_menu_count    INTEGER;
      v_pedido_count  INTEGER;
    BEGIN
      IF OLD.activo = true AND NEW.activo = false THEN
        SELECT COUNT(*) INTO v_menu_count
        FROM menu_semanal_dias msd
        JOIN menus_semanales ms ON ms.id = msd.menu_semanal_id
        WHERE msd.vianda_id = NEW.id AND ms.fecha_fin >= CURRENT_DATE;

        SELECT COUNT(*) INTO v_pedido_count
        FROM pedido_items pi
        JOIN pedidos p ON p.id = pi.pedido_id
        WHERE pi.plato_id = NEW.plato_id
          AND pi.guarnicion_id IS NOT DISTINCT FROM NEW.guarnicion_id
          AND pi.salsa_id IS NOT DISTINCT FROM NEW.salsa_id
          AND p.estado != 'cancelado'
          AND p.semana_inicio >= date_trunc('week', CURRENT_DATE)::date;

        IF v_menu_count > 0 OR v_pedido_count > 0 THEN
          RAISE EXCEPTION 'No se puede desactivar la vianda "%": en uso en % menu(s) de semana vigente y % pedido(s) activo(s)', NEW.nombre_vianda, v_menu_count, v_pedido_count
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $F$ LANGUAGE plpgsql;
  `);
}
