// Fase S2 del plan "semana como raiz" (chunk write-flip). Auto-popula `semana_id`
// en cada INSERT/UPDATE de las tablas ancladas por fecha, via un trigger
// BEFORE que hace getOrCreate de la semana. Asi TODA fila nueva queda linkeada
// sin tocar la transaccion critica de pedidos ni el resto del codigo de app.
//
// Es un PUENTE DE TRANSICION: lee NEW.semana_inicio/fecha_inicio para calcular el
// lunes. Se retira en S4, cuando el codigo de app setea semana_id directo y se
// dropean las columnas de fecha viejas. Necesario ahora para que el trigger
// trg_bloquear_desactivar_vianda (ya reescrito a semana_id) cuente los pedidos
// nuevos correctamente (write-before-read).
//
// getOrCreate concurrente-seguro: INSERT ... ON CONFLICT DO NOTHING + SELECT.

export function up(pgm) {
  pgm.sql(`
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

export function down(pgm) {
  pgm.sql(`
    DROP TRIGGER IF EXISTS set_semana_id ON pedidos;
    DROP TRIGGER IF EXISTS set_semana_id ON pedido_sugerencias;
    DROP TRIGGER IF EXISTS set_semana_id ON sugerencias_empleados;
    DROP TRIGGER IF EXISTS set_semana_id ON pedido_sugerencia_opciones;
    DROP TRIGGER IF EXISTS set_semana_id ON menus_semanales;
    DROP FUNCTION IF EXISTS set_semana_id_from_semana_inicio();
    DROP FUNCTION IF EXISTS set_semana_id_from_fecha_inicio();
  `);
}
