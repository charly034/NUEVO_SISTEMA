// plan-eng-review T3/B2: excepción de guarnición/salsa POR EMPRESA sobre una celda
// del menú. Es el peldaño superior de la cascada de resolución (ver
// pedidos.repository.js VIANDA_SLOT_COLS): excepción empresa → override de celda →
// vianda → plato → sin.
//
// Decisiones de diseño (ver design doc charl-feat-...-design-*.md):
//  - Ancla por CLAVES DE NEGOCIO (menu, categoria, dia, opcion, empresa), NO por el
//    id de la celda menu_semanal_dias. Así la excepción sobrevive al re-sembrado por
//    rotación, que regenera la fila de celda con id nuevo. Por eso NO hay FK a
//    menu_semanal_dias(id): el único CASCADE es al MENÚ.
//  - Guarda anti-rancio `plato_id_origen`: el plato para el que se escribió la
//    excepción. Al resolver, la excepción SOLO se aplica si el plato del slot sigue
//    siendo ese; si la rotación cambió el plato, la excepción no aplica (queda
//    "stale") y nunca impone p.ej. puré sobre pescado.
//  - Espeja EXACTAMENTE las 4 columnas de override de la celda; no hay
//    salsa_libre_override (el 'libre' es un valor del enum salsa_modo).
//  - opcion/dia son NULL para fijos (T9); el unique parcial los tolera con COALESCE.

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE menu_semanal_dia_empresa_override (
      id                          SERIAL PRIMARY KEY,
      menu_semanal_id             INTEGER      NOT NULL REFERENCES menus_semanales(id) ON DELETE CASCADE,
      categoria_id                INTEGER      NOT NULL REFERENCES categorias(id),
      dia                         dia_semana   NULL,
      opcion                      CHAR(1)      NULL,
      empresa_id                  INTEGER      NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      plato_id_origen             INTEGER      NOT NULL REFERENCES platos(id),
      guarnicion_modo_override    guarnicion_modo NULL,
      guarnicion_fija_override_id INTEGER      NULL REFERENCES guarniciones(id) ON DELETE SET NULL,
      salsa_modo_override         salsa_modo   NULL,
      salsa_fija_override_id      INTEGER      NULL REFERENCES salsas(id) ON DELETE SET NULL,
      created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    -- Unicidad de la excepción por (celda de negocio, empresa). dia/opcion pueden ser
    -- NULL (fijos, T9); NULLS NOT DISTINCT (PG15+) hace que dos filas con el mismo
    -- (menu, categoria, empresa) y dia/opcion NULL colisionen como duplicadas. Se
    -- evita COALESCE(dia::text,...) porque el cast enum→text no es IMMUTABLE y no
    -- sirve en expresiones de índice.
    CREATE UNIQUE INDEX menu_semanal_dia_empresa_override_uidx
      ON menu_semanal_dia_empresa_override
      (menu_semanal_id, categoria_id, dia, opcion, empresa_id) NULLS NOT DISTINCT;

    -- Índice de resolución: el read une por (menu, categoria, dia, opcion, empresa)
    -- + guarda de plato. Cubierto por el unique de arriba para el prefijo de claves.
    CREATE INDEX menu_semanal_dia_empresa_override_empresa_idx
      ON menu_semanal_dia_empresa_override (empresa_id, menu_semanal_id);
  `);
}

export function down(pgm) {
  pgm.sql('DROP TABLE IF EXISTS menu_semanal_dia_empresa_override;');
}
