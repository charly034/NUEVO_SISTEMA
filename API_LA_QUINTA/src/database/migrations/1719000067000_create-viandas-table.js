// Fase 1 del rediseno de dominio: Vianda como entidad propia (ver design doc de /office-hours
// y CEO plan 2026-07-10-vianda-como-entidad-propia.md). Antes, "vianda" era un conjunto de flags
// pegados a `platos` (disponible_vianda, guarnicion_modo, salsa_modo, nombre_vianda, etc).
// Esta migracion crea `viandas` como tabla propia (Plato + Guarnicion? + Salsa?, opcionalmente
// atada a una Empresa), migra los datos existentes, y agrega las reglas de negocio a nivel BD
// que la revision de /plan-ceo-review y /plan-eng-review exigieron:
//   - EV3: UNIQUE(plato_id, empresa_id) no deduplica NULLs en Postgres -> se usa
//     COALESCE(empresa_id, 0) como sentinel.
//   - 4A/OV5: bloqueo bidireccional (no desactivar un plato usado por vianda activa, ni una
//     vianda usada en el menu de la semana vigente o en un pedido activo) a nivel de trigger,
//     para cerrar la ventana de carrera (TOCTOU) que un chequeo solo en el service no cierra.
//   - OV3/EV4: nombre_vianda se autogenera (stored) y se regenera via trigger cuando cambia el
//     plato/guarnicion/salsa referenciado, PERO solo si el nombre fue autogenerado
//     (nombre_generado=true) -- si el admin puso un nombre propio ("Vianda Ejecutiva"), un
//     rename de sus componentes no lo pisa.
//   - 2A: el backfill no aborta ante guarnicion_fija_id/salsa_fija_id huerfanos (inactivos) --
//     crea la vianda igual con ese campo en null y deja un RAISE NOTICE por caso para revision.
//
// NOT in scope de esta migracion (ver CEO plan): unificar guarnicion+salsa en `acompanamientos`,
// migrar pedido_items.guarnicion_id/salsa_id, y la limpieza de columnas de `platos` -- eso es
// Fase 2, en un commit aparte, despues de verificar esta Fase 1 en produccion.

export function up(pgm) {
  pgm.sql(`
    -- 1. Tabla viandas
    -- salsa_libre: a diferencia de guarnicion ("libre" se infiere del legacy platos.tiene_guarnicion
    -- cuando no hay guarnicion_id fija), salsa nunca tuvo una columna legacy equivalente -- "elegir
    -- salsa libremente" es un valor propio del modelo viejo (salsa_modo='libre') que hay que poder
    -- expresar como default de la vianda, no solo como override de un slot semanal.
    CREATE TABLE IF NOT EXISTS viandas (
      id               SERIAL PRIMARY KEY,
      plato_id         INTEGER NOT NULL REFERENCES platos(id) ON DELETE RESTRICT,
      guarnicion_id    INTEGER NULL REFERENCES guarniciones(id) ON DELETE SET NULL,
      salsa_id         INTEGER NULL REFERENCES salsas(id) ON DELETE SET NULL,
      salsa_libre      BOOLEAN NOT NULL DEFAULT false,
      empresa_id       INTEGER NULL REFERENCES empresas(id) ON DELETE CASCADE,
      nombre_vianda    VARCHAR(200) NULL,
      nombre_generado  BOOLEAN NOT NULL DEFAULT true,
      activo           BOOLEAN NOT NULL DEFAULT true,
      created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT viandas_salsa_libre_excl CHECK (NOT (salsa_id IS NOT NULL AND salsa_libre))
    );

    -- EV3: sentinel COALESCE porque UNIQUE no deduplica NULL en empresa_id.
    CREATE UNIQUE INDEX IF NOT EXISTS viandas_plato_empresa_activo_idx
      ON viandas (plato_id, COALESCE(empresa_id, 0))
      WHERE activo;

    CREATE INDEX IF NOT EXISTS viandas_empresa_idx ON viandas (empresa_id);
    CREATE INDEX IF NOT EXISTS viandas_plato_idx ON viandas (guarnicion_id);
    CREATE INDEX IF NOT EXISTS viandas_salsa_idx ON viandas (salsa_id);

    -- 2. menu_semanal_dias gana vianda_id (convive con los overrides existentes, ver Open
    -- Question del design doc sobre destino final de guarnicion_modo_override/salsa_modo_override).
    ALTER TABLE menu_semanal_dias ADD COLUMN IF NOT EXISTS vianda_id INTEGER NULL REFERENCES viandas(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS menu_semanal_dias_vianda_idx ON menu_semanal_dias (vianda_id);

    -- 3. Funcion que arma el nombre automatico de una vianda a partir de su composicion.
    CREATE OR REPLACE FUNCTION fn_vianda_nombre_auto(p_plato_id INTEGER, p_guarnicion_id INTEGER, p_salsa_id INTEGER)
    RETURNS VARCHAR AS $F$
    DECLARE
      v_nombre    VARCHAR;
      v_parte     VARCHAR;
    BEGIN
      SELECT nombre INTO v_nombre FROM platos WHERE id = p_plato_id;

      IF p_guarnicion_id IS NOT NULL THEN
        SELECT nombre INTO v_parte FROM guarniciones WHERE id = p_guarnicion_id;
        IF v_parte IS NOT NULL THEN
          v_nombre := v_nombre || ' con ' || v_parte;
        END IF;
      END IF;

      IF p_salsa_id IS NOT NULL THEN
        SELECT nombre INTO v_parte FROM salsas WHERE id = p_salsa_id;
        IF v_parte IS NOT NULL THEN
          v_nombre := v_nombre || ' y salsa ' || v_parte;
        END IF;
      END IF;

      RETURN v_nombre;
    END;
    $F$ LANGUAGE plpgsql;

    -- 4. Trigger: autogenera/regenera nombre_vianda en la propia fila de viandas.
    -- nombre_generado distingue "nombre puesto por el admin" (ej. "Vianda Ejecutiva") de
    -- "nombre calculado" -- un cambio de composicion solo regenera si el nombre era calculado.
    CREATE OR REPLACE FUNCTION trg_vianda_set_nombre()
    RETURNS TRIGGER AS $F$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        IF NEW.nombre_vianda IS NULL THEN
          NEW.nombre_generado := true;
          NEW.nombre_vianda := fn_vianda_nombre_auto(NEW.plato_id, NEW.guarnicion_id, NEW.salsa_id);
        ELSE
          NEW.nombre_generado := false;
        END IF;
      ELSE
        IF NEW.nombre_vianda IS DISTINCT FROM OLD.nombre_vianda THEN
          IF NEW.nombre_vianda IS NULL THEN
            NEW.nombre_generado := true;
            NEW.nombre_vianda := fn_vianda_nombre_auto(NEW.plato_id, NEW.guarnicion_id, NEW.salsa_id);
          ELSE
            NEW.nombre_generado := false;
          END IF;
        ELSIF OLD.nombre_generado AND (
              NEW.plato_id IS DISTINCT FROM OLD.plato_id
           OR NEW.guarnicion_id IS DISTINCT FROM OLD.guarnicion_id
           OR NEW.salsa_id IS DISTINCT FROM OLD.salsa_id) THEN
          NEW.nombre_vianda := fn_vianda_nombre_auto(NEW.plato_id, NEW.guarnicion_id, NEW.salsa_id);
          NEW.nombre_generado := true;
        END IF;
      END IF;
      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    $F$ LANGUAGE plpgsql;

    CREATE TRIGGER viandas_set_nombre
      BEFORE INSERT OR UPDATE ON viandas
      FOR EACH ROW EXECUTE FUNCTION trg_vianda_set_nombre();

    -- 5. EV4 (+ extension consistente a platos, mismo bug): si el plato, la guarnicion o la
    -- salsa referenciada se renombra, regenerar nombre_vianda de las viandas que la usan --
    -- solo las que tienen nombre_generado=true (no pisar nombres puestos a mano).
    CREATE OR REPLACE FUNCTION trg_regenerar_viandas_por_plato()
    RETURNS TRIGGER AS $F$
    BEGIN
      IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
        UPDATE viandas
        SET nombre_vianda = fn_vianda_nombre_auto(plato_id, guarnicion_id, salsa_id), updated_at = NOW()
        WHERE plato_id = NEW.id AND nombre_generado = true;
      END IF;
      RETURN NEW;
    END;
    $F$ LANGUAGE plpgsql;

    CREATE TRIGGER platos_regenerar_vianda_nombre
      AFTER UPDATE ON platos
      FOR EACH ROW EXECUTE FUNCTION trg_regenerar_viandas_por_plato();

    CREATE OR REPLACE FUNCTION trg_regenerar_viandas_por_guarnicion()
    RETURNS TRIGGER AS $F$
    BEGIN
      IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
        UPDATE viandas
        SET nombre_vianda = fn_vianda_nombre_auto(plato_id, guarnicion_id, salsa_id), updated_at = NOW()
        WHERE guarnicion_id = NEW.id AND nombre_generado = true;
      END IF;
      RETURN NEW;
    END;
    $F$ LANGUAGE plpgsql;

    CREATE TRIGGER guarniciones_regenerar_vianda_nombre
      AFTER UPDATE ON guarniciones
      FOR EACH ROW EXECUTE FUNCTION trg_regenerar_viandas_por_guarnicion();

    CREATE OR REPLACE FUNCTION trg_regenerar_viandas_por_salsa()
    RETURNS TRIGGER AS $F$
    BEGIN
      IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
        UPDATE viandas
        SET nombre_vianda = fn_vianda_nombre_auto(plato_id, guarnicion_id, salsa_id), updated_at = NOW()
        WHERE salsa_id = NEW.id AND nombre_generado = true;
      END IF;
      RETURN NEW;
    END;
    $F$ LANGUAGE plpgsql;

    CREATE TRIGGER salsas_regenerar_vianda_nombre
      AFTER UPDATE ON salsas
      FOR EACH ROW EXECUTE FUNCTION trg_regenerar_viandas_por_salsa();

    -- 6. 4A: bloquear desactivar un plato referenciado por una vianda activa. BEFORE UPDATE +
    -- row lock cierra la ventana de carrera (TOCTOU) que un chequeo solo en platos.service.js
    -- no cierra: dos transacciones concurrentes sobre la misma fila de plato se serializan.
    CREATE OR REPLACE FUNCTION trg_bloquear_desactivar_plato()
    RETURNS TRIGGER AS $F$
    DECLARE
      v_count   INTEGER;
      v_nombres TEXT;
    BEGIN
      IF OLD.activo = true AND NEW.activo = false THEN
        SELECT COUNT(*), STRING_AGG(COALESCE(nombre_vianda, 'vianda #' || id), ', ')
        INTO v_count, v_nombres
        FROM viandas WHERE plato_id = NEW.id AND activo = true;

        IF v_count > 0 THEN
          RAISE EXCEPTION 'No se puede desactivar el plato "%": usado por % vianda(s) activa(s): %', NEW.nombre, v_count, v_nombres
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $F$ LANGUAGE plpgsql;

    CREATE TRIGGER platos_bloquear_desactivacion
      BEFORE UPDATE ON platos
      FOR EACH ROW EXECUTE FUNCTION trg_bloquear_desactivar_plato();

    -- 7. OV5: bloquear desactivar una vianda referenciada en el menu de la semana vigente
    -- (o futura) o en un pedido activo (no cancelado, de la semana actual en adelante).
    -- pedido_items no tiene vianda_id propio (guarda su propia eleccion de guarnicion/salsa,
    -- nivel 3 de la precedencia OV2) -- el match es por composicion (plato_id + guarnicion_id
    -- + salsa_id), que es la mejor aproximacion posible con el schema actual.
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

    CREATE TRIGGER viandas_bloquear_desactivacion
      BEFORE UPDATE ON viandas
      FOR EACH ROW EXECUTE FUNCTION trg_bloquear_desactivar_vianda();

    -- 8. 2A: backfill desde platos con disponible_vianda=true. Antes de insertar, deja un
    -- RAISE NOTICE por cada plato con guarnicion_fija_id/salsa_fija_id huerfano (inactivo) --
    -- no aborta el backfill, la vianda se crea igual con ese campo en null.
    DO $D$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN
        SELECT p.id, p.nombre
        FROM platos p
        WHERE p.disponible_vianda = true
          AND (
            (p.guarnicion_fija_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM guarniciones g WHERE g.id = p.guarnicion_fija_id AND g.activo))
            OR
            (p.salsa_fija_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM salsas s WHERE s.id = p.salsa_fija_id AND s.activo))
          )
      LOOP
        RAISE NOTICE 'Backfill viandas: plato % (id %) tiene guarnicion_fija_id/salsa_fija_id huerfano (inactivo/borrado) -- se crea la vianda sin ese campo, revisar manualmente', r.nombre, r.id;
      END LOOP;
    END;
    $D$;

    INSERT INTO viandas (plato_id, guarnicion_id, salsa_id, nombre_vianda, activo)
    SELECT
      p.id,
      CASE WHEN g.id IS NOT NULL AND g.activo THEN g.id ELSE NULL END,
      CASE WHEN s.id IS NOT NULL AND s.activo THEN s.id ELSE NULL END,
      p.nombre_vianda,
      true
    FROM platos p
    LEFT JOIN guarniciones g ON g.id = p.guarnicion_fija_id
    LEFT JOIN salsas s ON s.id = p.salsa_fija_id
    WHERE p.disponible_vianda = true;
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TRIGGER IF EXISTS viandas_bloquear_desactivacion ON viandas;
    DROP FUNCTION IF EXISTS trg_bloquear_desactivar_vianda();

    DROP TRIGGER IF EXISTS platos_bloquear_desactivacion ON platos;
    DROP FUNCTION IF EXISTS trg_bloquear_desactivar_plato();

    DROP TRIGGER IF EXISTS salsas_regenerar_vianda_nombre ON salsas;
    DROP FUNCTION IF EXISTS trg_regenerar_viandas_por_salsa();

    DROP TRIGGER IF EXISTS guarniciones_regenerar_vianda_nombre ON guarniciones;
    DROP FUNCTION IF EXISTS trg_regenerar_viandas_por_guarnicion();

    DROP TRIGGER IF EXISTS platos_regenerar_vianda_nombre ON platos;
    DROP FUNCTION IF EXISTS trg_regenerar_viandas_por_plato();

    DROP TRIGGER IF EXISTS viandas_set_nombre ON viandas;
    DROP FUNCTION IF EXISTS trg_vianda_set_nombre();

    DROP FUNCTION IF EXISTS fn_vianda_nombre_auto(INTEGER, INTEGER, INTEGER);

    ALTER TABLE menu_semanal_dias DROP COLUMN IF EXISTS vianda_id;

    DROP TABLE IF EXISTS viandas;
  `);
}
