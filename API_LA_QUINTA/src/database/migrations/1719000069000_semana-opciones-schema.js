// Schema para "organizar la semana por Opcion" (ver design doc
// charl-main-design-20260711-organizar-semana.md, CEO+ENG+DESIGN CLEARED).
// menu_semanal_dias.opcion es char(1) (letras 'A'/'B'/'C'...), no un entero
// -- opcion_default y empresa_opcion_semana.opcion usan el mismo tipo para
// poder compararse directo sin conversion.
//
// Piezas nuevas:
//   1. empresas.opcion_default       -- default estable, NULL = todas las opciones
//   2. empresa_opcion_semana         -- excepcion puntual por semana
//   3. ciclo_rotacion                -- "track" independiente de rotacion para un dia
//                                       (soporta N ciclos simultaneos por dia)
//   4. grupo_rotativo                -- miembro del ciclo (Grupo A, Grupo B...)
//   5. grupo_rotativo_plato          -- N platos por grupo, orden=0 es el default
//   6. grupo_rotativo_seleccion_semana -- fuerza grupo y/o plato para una semana puntual
//   7. rotacion_config                -- ancla global de rotacion (1 fila)
//   8. menu_semanal_dias.disponible_por_kilo -- exclusion por-kilo a nivel Opcion/dia
//
// Los platos fijo_dia/siempre existentes en platos.disponibilidad NO se tocan
// ni se migran (decision cerrada en /plan-eng-review) -- ciclo_rotacion es un
// sistema nuevo y separado, solo para lo que el admin arme a mano.

export function up(pgm) {
  pgm.sql(`
    ALTER TABLE empresas ADD COLUMN IF NOT EXISTS opcion_default CHAR(1) NULL;

    CREATE TABLE IF NOT EXISTS empresa_opcion_semana (
      id SERIAL PRIMARY KEY,
      menu_semanal_id INTEGER NOT NULL REFERENCES menus_semanales(id) ON DELETE CASCADE,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      opcion CHAR(1) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (menu_semanal_id, empresa_id)
    );

    CREATE TABLE IF NOT EXISTS ciclo_rotacion (
      id SERIAL PRIMARY KEY,
      dia_semana dia_semana NOT NULL,
      nombre VARCHAR(140) NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ciclo_rotacion_dia_idx ON ciclo_rotacion (dia_semana);

    CREATE TABLE IF NOT EXISTS grupo_rotativo (
      id SERIAL PRIMARY KEY,
      ciclo_rotacion_id INTEGER NOT NULL REFERENCES ciclo_rotacion(id) ON DELETE CASCADE,
      nombre VARCHAR(140) NOT NULL,
      orden INTEGER NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (ciclo_rotacion_id, orden)
    );

    CREATE TABLE IF NOT EXISTS grupo_rotativo_plato (
      grupo_rotativo_id INTEGER NOT NULL REFERENCES grupo_rotativo(id) ON DELETE CASCADE,
      plato_id INTEGER NOT NULL REFERENCES platos(id) ON DELETE RESTRICT,
      orden INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (grupo_rotativo_id, plato_id)
    );

    CREATE TABLE IF NOT EXISTS grupo_rotativo_seleccion_semana (
      id SERIAL PRIMARY KEY,
      menu_semanal_id INTEGER NOT NULL REFERENCES menus_semanales(id) ON DELETE CASCADE,
      ciclo_rotacion_id INTEGER NOT NULL REFERENCES ciclo_rotacion(id) ON DELETE CASCADE,
      grupo_rotativo_id INTEGER NOT NULL REFERENCES grupo_rotativo(id) ON DELETE RESTRICT,
      plato_id INTEGER NULL REFERENCES platos(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (menu_semanal_id, ciclo_rotacion_id)
    );

    CREATE TABLE IF NOT EXISTS rotacion_config (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      fecha_ancla DATE NOT NULL
    );

    ALTER TABLE menu_semanal_dias ADD COLUMN IF NOT EXISTS disponible_por_kilo BOOLEAN NOT NULL DEFAULT true;
  `);
}

export function down(pgm) {
  pgm.sql(`
    ALTER TABLE menu_semanal_dias DROP COLUMN IF EXISTS disponible_por_kilo;

    DROP TABLE IF EXISTS rotacion_config;
    DROP TABLE IF EXISTS grupo_rotativo_seleccion_semana;
    DROP TABLE IF EXISTS grupo_rotativo_plato;
    DROP TABLE IF EXISTS grupo_rotativo;
    DROP TABLE IF EXISTS ciclo_rotacion;
    DROP TABLE IF EXISTS empresa_opcion_semana;

    ALTER TABLE empresas DROP COLUMN IF EXISTS opcion_default;
  `);
}
