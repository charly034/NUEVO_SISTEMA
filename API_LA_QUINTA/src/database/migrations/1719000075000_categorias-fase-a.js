// Fase A del teardown "la semana es el contenedor" (design doc aprobado
// 2026-07-13, charl-main-design). Objetivo: dejar el esquema listo para que
// las categorias existan como DATOS (no hardcodeadas en el frontend), con
// CERO cambio de comportamiento observable. Nada lee categoria_id todavia.
//
// Decision de diseno importante: se hacen solo AMPLIACIONES de esquema
// seguras (agregar categoria_id, volver dia/opcion nullable). El rediseno de
// la constraint UNIQUE(menu_semanal_id, dia, opcion) se DIFIERE a Fase B,
// que es cuando de verdad llegan filas con dia=NULL (fijos materializados) y
// se puede probar la constraint nueva contra datos reales. En Fase A no
// existe ninguna fila con dia/opcion NULL, asi que la constraint vieja sigue
// valiendo perfecta -- volver las columnas nullable es un widening que no
// afecta ninguna fila ni query existente (los WHERE dia='lunes' simplemente
// no matchean NULLs, y no hay NULLs).
//
// Guarniciones/Salsas NO migran: ya son por-semana (menu_semanal_guarniciones
// /menu_semanal_salsas). Sus categorias de sistema son vistas finas sobre
// esas tablas. Solo los PLATOS (Especiales + Fijos + custom) se unifican en
// menu_semanal_dias -- y en Fase A solo se back-pobla Especiales (los Fijos
// se materializan en Fase B).

export function up(pgm) {
  pgm.sql(`
    -- ── Tabla de categorias ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS categorias (
      id              SERIAL PRIMARY KEY,
      nombre          VARCHAR(100) NOT NULL,
      slug            VARCHAR(50) NOT NULL UNIQUE,
      tipo_dato       VARCHAR(20) NOT NULL CHECK (tipo_dato IN ('platos', 'guarniciones', 'salsas')),
      alcance         VARCHAR(20) NOT NULL DEFAULT 'recurrente' CHECK (alcance IN ('semana', 'recurrente')),
      menu_semanal_id INTEGER NULL REFERENCES menus_semanales(id) ON DELETE CASCADE,
      modo            VARCHAR(30) NOT NULL DEFAULT 'plato_distinto_por_dia'
                        CHECK (modo IN ('plato_distinto_por_dia', 'plato_unico_todos_los_dias')),
      usa_opcion      BOOLEAN NOT NULL DEFAULT false,
      es_sistema      BOOLEAN NOT NULL DEFAULT false,
      orden           INTEGER NOT NULL DEFAULT 0,
      activo          BOOLEAN NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- alcance='semana' exige menu_semanal_id; 'recurrente' exige que sea NULL.
      CONSTRAINT categorias_alcance_menu_chk CHECK (
        (alcance = 'semana'     AND menu_semanal_id IS NOT NULL) OR
        (alcance = 'recurrente' AND menu_semanal_id IS NULL)
      )
    );

    CREATE INDEX IF NOT EXISTS categorias_menu_idx ON categorias (menu_semanal_id);

    -- ── Defaults de vianda/kilo/visibilidad por categoria (fila opcional) ─
    CREATE TABLE IF NOT EXISTS categoria_defaults_vianda (
      categoria_id                 INTEGER PRIMARY KEY REFERENCES categorias(id) ON DELETE CASCADE,
      default_vianda_activa        BOOLEAN NOT NULL DEFAULT true,
      default_disponible_por_kilo  BOOLEAN NOT NULL DEFAULT true,
      default_empresa_ids          INTEGER[] NULL
    );

    -- ── Grupos de rotacion propios de la categoria ─────────────────────
    -- (decision Fase 2: NO reusar ciclo_rotacion; el grupo entero se
    -- activa/desactiva por semana segun un criterio). Ej: categoria "Tartas",
    -- grupo A activo semanas pares, grupo B impares.
    CREATE TABLE IF NOT EXISTS categoria_grupo (
      id            SERIAL PRIMARY KEY,
      categoria_id  INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
      nombre        VARCHAR(100) NOT NULL,
      criterio      VARCHAR(20) NOT NULL DEFAULT 'siempre'
                      CHECK (criterio IN ('siempre', 'pares', 'impares', 'ciclo')),
      ciclo_offset  INTEGER NULL,   -- solo si criterio='ciclo'
      orden         INTEGER NOT NULL DEFAULT 0,
      activo        BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS categoria_grupo_categoria_idx ON categoria_grupo (categoria_id);

    CREATE TABLE IF NOT EXISTS categoria_grupo_plato (
      categoria_grupo_id  INTEGER NOT NULL REFERENCES categoria_grupo(id) ON DELETE CASCADE,
      plato_id            INTEGER NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
      orden               INTEGER NOT NULL DEFAULT 0,
      UNIQUE (categoria_grupo_id, plato_id)
    );

    -- ── menu_semanal_dias: agregar categoria_id + widening de dia/opcion ─
    ALTER TABLE menu_semanal_dias
      ADD COLUMN IF NOT EXISTS categoria_id INTEGER NULL REFERENCES categorias(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS menu_semanal_dias_categoria_idx ON menu_semanal_dias (categoria_id);

    -- dia/opcion nullable: los fijos (Fase B) tendran dia=NULL (todos los
    -- dias) y opcion=NULL (sin letra). No se toca la constraint UNIQUE
    -- todavia (ver comentario de cabecera).
    ALTER TABLE menu_semanal_dias ALTER COLUMN dia DROP NOT NULL;
    ALTER TABLE menu_semanal_dias ALTER COLUMN opcion DROP NOT NULL;

    -- ── Sembrar las 5 categorias del sistema ───────────────────────────
    INSERT INTO categorias (nombre, slug, tipo_dato, alcance, modo, usa_opcion, es_sistema, orden)
    VALUES
      ('Especiales',        'especiales',        'platos',       'recurrente', 'plato_distinto_por_dia',     true,  true, 1),
      ('Fijos x día',       'fijos-x-dia',       'platos',       'recurrente', 'plato_distinto_por_dia',     false, true, 2),
      ('Fijos de siempre',  'fijos-de-siempre',  'platos',       'recurrente', 'plato_unico_todos_los_dias', false, true, 3),
      ('Guarniciones',      'guarniciones',      'guarniciones', 'recurrente', 'plato_distinto_por_dia',     false, true, 4),
      ('Salsas',            'salsas',            'salsas',       'recurrente', 'plato_distinto_por_dia',     false, true, 5)
    ON CONFLICT (slug) DO NOTHING;

    -- ── Backfill: todas las filas actuales de menu_semanal_dias son
    -- especiales (historicamente esa tabla solo tuvo especiales; los fijos
    -- vivian en platos.disponibilidad y se materializan recien en Fase B) ─
    UPDATE menu_semanal_dias
    SET categoria_id = (SELECT id FROM categorias WHERE slug = 'especiales')
    WHERE categoria_id IS NULL;
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE menu_semanal_dias DROP COLUMN IF EXISTS categoria_id;
    -- Nota: no se re-agrega NOT NULL a dia/opcion en el down porque podrian
    -- existir filas con NULL si se avanzo a Fase B; el rollback de esta
    -- migracion se piensa solo para el estado inmediatamente posterior a
    -- Fase A (sin filas NULL). Si hiciera falta, restaurar el NOT NULL es una
    -- migracion aparte.
    DROP TABLE IF EXISTS categoria_grupo_plato;
    DROP TABLE IF EXISTS categoria_grupo;
    DROP TABLE IF EXISTS categoria_defaults_vianda;
    DROP TABLE IF EXISTS categorias;
  `);
}
